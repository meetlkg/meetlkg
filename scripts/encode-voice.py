"""Join neural audio without changing speed; encode gapless MP3 and mouth timing."""
import array,json,math,pathlib,sys,wave
import av
source=json.loads(pathlib.Path(sys.argv[1]).read_text());dest=pathlib.Path(sys.argv[2]);rate=24000
samples=array.array('h');cues=[];words=[]
for i,chunk in enumerate(source['chunks']):
    offset=len(samples)/rate*1000
    for shape,start,length in zip(chunk['visemes'],chunk['vtimes'],chunk['vdurations']):
        if isinstance(start,(int,float)) and isinstance(length,(int,float)) and math.isfinite(start) and math.isfinite(length) and length>0:cues.append([shape,round(offset+max(0,start),2),round(length,2)])
    for word,start,length in zip(chunk['words'],chunk['wtimes'],chunk['wdurations']):
        if isinstance(start,(int,float)) and isinstance(length,(int,float)) and math.isfinite(start) and math.isfinite(length) and length>0:
            words.append([word,round(offset+start,2),round(length,2)])
    with wave.open(chunk['path'],'rb') as audio:
        assert audio.getframerate()==rate and audio.getsampwidth()==2 and audio.getnchannels()==1
        block=array.array('h');block.frombytes(audio.readframes(audio.getnframes()));samples.extend(block)
    if i<len(source['chunks'])-1:samples.extend([0]*int(rate*.10))
# Gentle uniform gain: preserve all timing and dynamics, prevent clipping.
rms=math.sqrt(sum(x*x for x in samples)/len(samples))/32768;peak=max(abs(x) for x in samples)/32768
gain=min(.105/max(rms,.001),.96/max(peak,.001),2.0)
samples=array.array('h',(round(x*gain) for x in samples));hop=240
energy=[math.sqrt(sum(x*x for x in samples[i:i+hop])/max(1,len(samples[i:i+hop])))/32768 for i in range(0,len(samples),hop)]
reference=sorted(energy)[int(len(energy)*.90)] or 1
energy=[round(min(1,e/reference),3) for e in energy]
path=dest/(source['id']+'.mp3');temporary=dest/('.'+source['id']+'.tmp.mp3');output=av.open(str(temporary),'w',format='mp3');stream=output.add_stream('libmp3lame',rate=rate);stream.bit_rate=96000;stream.layout='mono'
resampler=av.AudioResampler(format='fltp',layout='mono',rate=rate)
for offset in range(0,len(samples),24000):
    block=samples[offset:offset+24000];frame=av.AudioFrame(format='s16',layout='mono',samples=len(block));frame.sample_rate=rate;frame.planes[0].update(block.tobytes())
    for converted in resampler.resample(frame):
        for packet in stream.encode(converted):output.mux(packet)
for packet in stream.encode(None):output.mux(packet)
output.close()
with av.open(str(temporary)) as check:
    decoded=sum(f.samples for f in check.decode(audio=0))
# LAME can retain a sub-frame tail (<5 ms) after gapless trimming.
assert abs(decoded-len(samples))<=rate*.005,(decoded,len(samples),'encoder delay mismatch')
temporary.replace(path)
result={k:source[k] for k in ['text','spokenText','voice']};result.update(dict(timingVersion=2,duration=round(len(samples)/rate,4),sampleRate=rate,visemes=sorted(cues,key=lambda cue:cue[1]),words=words,energy=energy,energyStepMs=10,audio=path.name))
trackfile=dest/('.'+source['id']+'.tmp.json');trackfile.write_text(json.dumps(result,separators=(',',':')));trackfile.replace(dest/(source['id']+'.json'))
print(f'{len(samples)/rate:.1f}s {path.stat().st_size} bytes; {len(cues)} phoneme cues')

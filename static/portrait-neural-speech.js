// Precomputed neural facial motion. Playback needs no model or inference server.
export const neuralSpeechRevision='speech-20261018-7';
export const neuralSpeechChannels=[
 ...Array.from({length:16},(_,i)=>`speechMotion${String(i).padStart(2,'0')}`),
 ...Array.from({length:16},(_,i)=>`speechColor${String(i).padStart(2,'0')}`)
];
export function validateNeuralMotion(motion,track){
 if(motion?.version!==1||motion.rig!==neuralSpeechRevision||motion.model!=='StreamingTalker'||motion.audio!==track.audio||motion.fps!==30||!Number.isFinite(motion.duration)||Math.abs(motion.duration-track.duration)>.06)throw Error('Facial motion does not match this recording.');
 if(!Array.isArray(motion.channels)||motion.channels.length!==neuralSpeechChannels.length||motion.channels.some((name,i)=>name!==neuralSpeechChannels[i]))throw Error('Facial motion does not match this portrait.');
 if(!Array.isArray(motion.frames)||motion.frames.length!==Math.ceil(motion.duration*motion.fps)+1||motion.frames.some(frame=>!Array.isArray(frame)||frame.length!==neuralSpeechChannels.length||frame.some(x=>!Number.isFinite(x)||Math.abs(x)>1.5)))throw Error('Facial motion is incomplete.');
 return motion;
}
export function sampleNeuralMotion(motion,seconds){
 if(!motion||!Number.isFinite(seconds)||seconds<0||seconds>motion.duration)return null;
 const position=seconds*motion.fps,index=Math.floor(position),fraction=position-index;
 const a=motion.frames[index],b=motion.frames[index+1]||a;
 if(!a)return null;
 return Object.fromEntries(neuralSpeechChannels.map((name,i)=>[name,a[i]+(b[i]-a[i])*fraction]));
}

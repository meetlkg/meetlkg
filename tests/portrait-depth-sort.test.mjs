import test from 'node:test';
import assert from 'node:assert/strict';
import {createPoseSortQueue} from '../static/portrait-depth-sort.js';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('moving geometry is presented only after its matching depth order is ready',async()=>{
 const gate=deferred(),seen=[],sorted=[];
 const queue=createPoseSortQueue({sort:async pose=>{sorted.push(pose);await gate.promise},present:pose=>seen.push(pose)});
 const pose={yaw:.2,weights:[.7]};queue.submit(pose);
 assert.deepEqual(sorted,[pose]);assert.deepEqual(seen,[]);
 assert.equal(queue.status().sorting,true);
 gate.resolve();await tick();
 assert.deepEqual(seen,[pose]);assert.equal(queue.status().presented,1);
 await queue.dispose();
});

test('rapid turns coalesce to the newest pose without presenting an unsorted frame',async()=>{
 const gates=[deferred(),deferred()],sorted=[],seen=[];
 const queue=createPoseSortQueue({sort:async pose=>{const n=sorted.length;sorted.push(pose);await gates[n].promise},present:pose=>seen.push(pose)});
 queue.submit('left');queue.submit('middle');queue.submit('right');
 assert.deepEqual(sorted,['left']);assert.deepEqual(seen,[]);
 gates[0].resolve();await tick();
 assert.deepEqual(seen,['left']);assert.deepEqual(sorted,['left','right']);
 assert.equal(queue.status().sorting,true);
 gates[1].resolve();await tick();
 assert.deepEqual(seen,['left','right']);assert.equal(queue.status().presented,3);
 assert.equal(queue.status().pending,false);await queue.dispose();
});

test('disposal waits for the worker and does not present a disposed portrait',async()=>{
 const gate=deferred(),seen=[];const queue=createPoseSortQueue({sort:()=>gate.promise,present:p=>seen.push(p)});
 queue.submit('old');queue.submit('new');const done=queue.dispose();gate.resolve();await done;
 assert.deepEqual(seen,[]);queue.submit('late');assert.equal(queue.status().pending,false);
});

test('a failed sort preserves the last valid rendered pose and reports the failure',async()=>{
 const seen=[],errors=[];let fail=false;
 const queue=createPoseSortQueue({sort:async()=>{if(fail)throw Error('worker failed')},present:p=>seen.push(p),onError:e=>errors.push(e.message)});
 queue.submit('valid');await tick();fail=true;queue.submit('invalid');await tick();
 assert.deepEqual(seen,['valid']);assert.deepEqual(errors,['worker failed']);assert.equal(queue.status().error,'worker failed');await queue.dispose();
});

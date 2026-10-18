import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../static/avatar3d/three.module.js';

// Execute the vendored class-field method itself against an isolated worker.
// Its constructor creates a DOM/WebGL viewer, which this regression does not need.
const rendererSource=readFileSync(new URL('../static/avatar3d/renderer.js',import.meta.url),'utf8');
const begin=rendererSource.indexOf('    runSplatSort = function() {');
const end=rendererSource.indexOf('    /**\n     * Determine which splats',begin);
assert.ok(begin>0&&end>begin);
const expression=rendererSource.slice(begin,end).trim().replace(/^runSplatSort = /,'').replace(/;$/,'');
const makeSorter=()=>new Function('THREE',`return (${expression});`)(THREE);

test('the actual vendored sorter requires a forced full sort for stationary-camera geometry changes',async()=>{
 const messages=[],count=3;
 const camera={position:new THREE.Vector3(0,0,2),quaternion:new THREE.Quaternion(),matrixWorld:new THREE.Matrix4(),projectionMatrix:new THREE.Matrix4()};
 const state={initialized:true,sortRunning:false,camera,splatMesh:{getSplatCount:()=>count,dynamicMode:false,matrixWorld:new THREE.Matrix4()},
  gatherSceneNodesForSort:()=>({splatRenderCount:count,shouldSortAll:true}),gpuAcceleratedSort:false,
  sharedMemoryForWorkers:false,sortWorkerIndexesToSort:new Uint32Array([0,1,2]),sortWorkerTransforms:new Float32Array(16),preSortMessages:[],
  sortWorker:{postMessage:message=>messages.push(message)}};
 const run=makeSorter().bind(state);
 assert.equal(await run(true,true),true);assert.equal(messages.at(-1).sort.splatSortCount,count);
 state.sortRunning=false;state.sortPromiseResolver();await state.sortPromise;
 messages.length=0;
 const centers=new Float32Array([0,0,2,1,0,0,1,1,0,0,0,1]);
 state.preSortMessages.push({centers:centers.buffer,sceneIndexes:new Uint32Array(count).buffer,range:{from:0,count}});
 assert.equal(await run(),false,'moving centers alone do not trigger this static-scene viewer');
 assert.equal(messages.length,0);
 assert.equal(await run(true,true),true);
 assert.equal(messages.length,2);assert.equal(messages[0].centers,centers.buffer);
 assert.equal(messages[1].sort.splatSortCount,count,'the complete animated portrait must be reordered');
 state.sortRunning=false;state.sortPromiseResolver();await state.sortPromise;
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {selectMemories,validateResult} from '../backend/workflows.mjs';
const records=[{id:'a',text:'我想先找产品运营实习，但还没有决定。',createdAt:'2026-10-01'},{id:'b',text:'今天的模拟面试让我发现自己没有讲清楚贡献。',createdAt:'2026-10-02'}];
test('少量记忆全部供语义比较，不因为没有共同关键词漏掉记录',()=>assert.equal(selectMemories(records,'团队影响').length,2));
test('禁止伪造引用或引用不存在的记录',()=>{
 assert.throws(()=>validateResult('recall',{items:[{kind:'观察',text:'假结论',evidence:[{recordId:'missing',quote:'不存在'}]}]},records));
 assert.throws(()=>validateResult('recall',{items:[{kind:'观察',text:'假结论',evidence:[{recordId:'a',quote:'我已经决定'}]}]},records));
});
test('观点变化必须引用两条不同记录，且关联必须同时引用双方',()=>{
 assert.throws(()=>validateResult('review',{items:[{kind:'变化',text:'发生变化',evidence:[{recordId:'a',quote:'还没有决定'}]}]},records));
 assert.throws(()=>validateResult('relate',{links:[{recordId:'b',relation:'补充',reason:'相关',evidence:[{recordId:'a',quote:'还没有决定'}]}]},records,'a'));
});
test('无关联是合法结果，不强行制造记忆关系',()=>assert.deepEqual(validateResult('relate',{links:[]},records,'a').links,[]));
test('有效原话证据保留',()=>assert.equal(validateResult('understand',{items:[{kind:'观点',text:'仍在考虑实习方向',evidence:[{recordId:'a',quote:'还没有决定'}]}]},records,'a').items.length,1));
import {invalidateMemory} from '../src/memory.js';
test('修订/删除记录使依赖的关联和总结失效，保留无关原始记录',()=>{
 const state={revision:1,thoughts:[{id:'a',ai:{items:[]},links:[]},{id:'b',text:'原话',links:[{recordId:'a'}]}],reply:{items:[]},review:{items:[]},feedback:[{from:'a',to:'b'}]};invalidateMemory(state,'a');assert.equal(state.thoughts[0].ai,undefined);assert.deepEqual(state.thoughts[1].links,[]);assert.equal(state.thoughts[1].text,'原话');assert.equal(state.reply,null);assert.equal(state.review,null);assert.equal(state.revision,2);
});

test('播客嘉宾原话不能作为用户经历的证据',()=>{
 const user=[{id:'a',text:'我还没有决定职业方向。',context:{text:'我在腾讯工作十五年。'}}];
 assert.throws(()=>validateResult('understand',{items:[{kind:'观点',text:'用户在腾讯工作十五年',evidence:[{recordId:'a',quote:'我在腾讯工作十五年'}]}]},user,'a'),/引用/);
});

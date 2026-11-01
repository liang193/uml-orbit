import test from 'node:test';
import assert from 'node:assert/strict';
import {formatMember,suggestJava} from '../java-assist.js';
import {parseJavaSources} from '../java-import.js';
import {nodeSize,classifierHeader,memberDisplay,textWidth} from '../router.js';
import {readFile} from 'node:fs/promises';
test('normalizes Java fields, methods, constructors and generic parameters',()=>{
  assert.equal(formatMember('private final Map<String, List<User>> users = new HashMap<>();'),'- users: Map<String, List<User>>');
  assert.equal(formatMember('public static Optional<User> find(final Long id, String... names) throws IOException;'),'+ find(id: Long, names: String...): Optional<User> {static}');
  assert.equal(formatMember('public User(String name)'),'+ User(name: String)');
  assert.equal(formatMember('+  find(id:Long, name:String):User'),'+ find(id: Long, name: String): User');
});
test('Java completion uses project types and type-aware field names',()=>{
  assert.ok(suggestJava('- repository: Or',16,'attrs',['OrderRepository']).some(c=>c.label==='OrderRepository'));
  assert.ok(suggestJava('private String na',17,'attrs').some(c=>c.label==='name'));
  assert.ok(suggestJava('private List<Order> or',22,'attrs').some(c=>c.label==='orders'));
});
test('class box expands to fit every full member in one line',()=>{
  const rows=['- 用户订单映射集合: Map<String, List<VeryLongCustomerOrderItemType>>','+ findCustomerOrdersByAccountAndStatus(accountIdentifier: String, status: OrderStatus): List<CustomerOrder> {abstract}'];
  const n={type:'class',name:'VeryLongClassName',attrs:[rows[0]],methods:[rows[1]]},size=nodeSize(n);
  assert.ok(size.w>700);for(const line of rows)assert.ok(size.w>textWidth(memberDisplay(line))+32);
  assert.equal(classifierHeader(n).stereotype,'');assert.equal(classifierHeader({...n,type:'abstract'}).stereotype,'');assert.equal(classifierHeader({...n,type:'interface'}).stereotype,'interface');
});
test('reads multiple Java files with inheritance, implementation and field references',()=>{
  const m=parseJavaSources([{name:'Store.java',content:'package demo; public interface Store { void save(User user); }'},{name:'Base.java',content:'package demo; public abstract class Base { protected Long id; public abstract void reset(); }'},{name:'User.java',content:'package demo; public class User extends Base implements Store { private List<User> friends; private String title="class Fake {}"; public void save(User user) { if(true) { System.out.println("hi"); } } }'}]);
  assert.equal(m.nodes.length,3);const user=m.nodes.find(n=>n.id==='demo.User');assert.deepEqual(user.attrs,['- friends: List<User>','- title: String']);assert.deepEqual(user.methods,['+ save(user: User): void']);assert.equal(m.nodes.find(n=>n.id==='demo.Base').type,'abstract');
  assert.ok(m.edges.some(e=>e.type==='inheritance'&&e.target==='demo.Base'));assert.ok(m.edges.some(e=>e.type==='realization'&&e.target==='demo.Store'));assert.ok(m.edges.some(e=>e.type==='directed'&&e.label==='friends'));
});
test('ignores comments, skips method bodies, keeps record fields and nested classes',()=>{
  const m=parseJavaSources([{name:'Example.java',content:'/* class Fake {} */ public record User(String name, int age) { public String label(){ return "🙂 class Other {}"; } public class Inner { private int count; } }'}]);
  assert.equal(m.nodes.length,2);const user=m.nodes.find(n=>n.id==='User');assert.deepEqual(user.attrs,['- name: String','- age: int']);assert.ok(m.nodes.some(n=>n.id==='User.Inner'));assert.equal(user.methods.length,1);
});
test('does not guess aggregation or missing external parents',()=>{const m=parseJavaSources([{name:'A.java',content:'class A extends Missing { private B b; } class B {}'}]);assert.ok(m.warnings.length);assert.equal(m.edges.length,1);assert.equal(m.edges[0].type,'directed');assert.equal(parseJavaSources([{name:'A.java',content:'class A { B b; } class B {}'}],{fieldRelations:false}).edges.length,0);});
test('generic parameter bounds are not mistaken for class inheritance',()=>{const m=parseJavaSources([{name:'Types.java',content:'class Entity {} class Base<T> {} interface Store<T> {} class Repository<T extends Entity> extends Base<T> implements Store<T> {}'}]);assert.equal(m.edges.length,2);assert.ok(m.edges.some(e=>e.target==='Base'));assert.ok(m.edges.some(e=>e.target==='Store'));assert.ok(!m.edges.some(e=>e.target==='Entity'));});
test('real-world commented UML demo preserves members and identifies structural and usage relationships',async()=>{
  const content=await readFile(new URL('./fixtures/relations-demo.java',import.meta.url),'utf8'),m=parseJavaSources([{name:'UmlDemoMain.java',content}]);
  assert.equal(m.nodes.length,9);
  const employee=m.nodes.find(n=>n.name==='Employee'),company=m.nodes.find(n=>n.name==='Company');
  assert.deepEqual(employee.attrs,['- idCard: IdCard']);assert.ok(employee.methods.includes('+ useTool(tool: Tool): void'));
  assert.deepEqual(company.attrs,['- companyName: String','- employees: Employee[]']);
  for(const n of m.nodes)for(const line of [...n.attrs,...n.methods])assert.doesNotMatch(line,/\/\/|【|关联|聚合|依赖/);
  const relation=(source,target,type)=>m.edges.find(e=>e.source===source&&e.target===target&&e.type===type);
  assert.ok(relation('Employee','Person','inheritance'));assert.ok(relation('Employee','Workable','realization'));
  assert.ok(relation('Employee','IdCard','directed'));assert.ok(relation('Employee','Tool','dependency'));
  const aggregation=relation('Company','Employee','aggregation');assert.equal(aggregation.start,'diamond');assert.equal(aggregation.targetCardinality,'0..*');assert.equal(aggregation.inferred,true);
  const composition=relation('House','Room','composition');assert.equal(composition.start,'filledDiamond');assert.equal(composition.inferred,true);
  for(const target of ['IdCard','Employee','Tool','Company','House'])assert.ok(relation('UmlDemoMain',target,'dependency'));
  assert.ok(m.warnings.some(w=>w.includes('候选')));
  const plain=parseJavaSources([{name:'Demo.java',content}],{inferOwnership:false});assert.ok(!plain.edges.some(e=>['composition','aggregation'].includes(e.type)));
  const rects=m.nodes.map(n=>({...nodeSize(n),x:n.x,y:n.y}));for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){const a=rects[i],b=rects[j];assert.ok(!(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y));}
});
test('ownership candidates are conservative and true reciprocal fields produce one association',()=>{
  const m=parseJavaSources([{name:'A.java',content:'class A { private B b = new B(); public B getB(){return b;} public void use(B b){this.b=b;} } class B { private A owner; }'}]);
  assert.equal(m.edges.filter(e=>e.type==='association').length,1);assert.ok(!m.edges.some(e=>e.type==='composition'));
  const dep=parseJavaSources([{name:'Use.java',content:'class Use { public B find(B input) throws B {return input;} } class B {}'}]);assert.equal(dep.edges.length,1);assert.equal(dep.edges[0].type,'dependency');assert.equal(dep.edges[0].line,'dashed');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {formatMember,suggestJava} from '../java-assist.js';
import {parseJavaSources} from '../java-import.js';
import {nodeSize,classifierHeader,memberDisplay,textWidth} from '../router.js';
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

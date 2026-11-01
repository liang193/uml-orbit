// ========== 【接口】用于【实现 Realization】关系 ==========
interface Workable { void work(); }
// ========== 父类：用于【继承（泛化 Generalization）】 ==========
class Person {
    protected String name;
    public Person(String name) { this.name = name; }
    public void sayHello() { System.out.println("Hello, I'm " + name); }
}
class Employee extends Person implements Workable {
    // 【关联 Association】：员工和工牌，平等双向关联，互相持有引用
    private IdCard idCard;
    public Employee(String name, IdCard idCard) { super(name); this.idCard = idCard; }
    @Override public void work() { System.out.println(name + " is working."); }
    // 【依赖 Dependency】：方法入参是Tool，只是临时用一下，用完就丢
    public void useTool(Tool tool) { tool.use(); }
}
class IdCard {
    private String idNum;
    public IdCard(String idNum) { this.idNum = idNum; }
}
class Tool { public void use() { System.out.println("Using tool"); } }
// 聚合：公司没了，员工依然可以存在，独立生命周期
class Company {
    private String companyName;
    // 聚合：整体持有多个部分，部分独立
    private Employee[] employees;
    public Company(String companyName, Employee[] employees) {
        this.companyName = companyName; this.employees = employees;
    }
}
// 组合：生命周期绑定
class House {
    private Room room;
    public House() {
        // 组合：在整体内部 new 出来，整体负责创建销毁部分
        room = new Room();
    }
}
class Room {}
public class UmlDemoMain {
    public static void main(String[] args) {
        IdCard card = new IdCard("10001");
        Employee emp = new Employee("ZhangSan", card);
        emp.sayHello(); emp.work(); emp.useTool(new Tool());
        Company company = new Company("ABC公司", new Employee[]{emp});
        House house = new House();
    }
}

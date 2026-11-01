import { TestBed } from '@angular/core/testing';
import { BuildCard } from './build-card';
const build = {
  id: 'database-id',
  title: 'My Civic',
  author: 'driver',
  car: 'Honda Civic',
  category: 'Street',
  image: 'https://example.com/car.png',
  budget: 0,
  parts: [],
  isOwn: true,
  isPublic: false,
};
describe('Database build card', () => {
  it('labels an own private build and does not invent an example budget', () => {
    TestBed.configureTestingModule({ imports: [BuildCard] });
    const fixture = TestBed.createComponent(BuildCard);
    fixture.componentRef.setInput('build', build);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('ของคุณ');
    expect(text).toContain('ส่วนตัว');
    expect(text).toContain('ยังไม่ระบุ');
    expect(text).not.toContain('งบประมาณตัวอย่าง');
    expect(text).not.toContain('ใช้เป็นต้นแบบ Build');
  });
  it('keeps public community builds free of own/private badges', () => {
    TestBed.configureTestingModule({ imports: [BuildCard] });
    const fixture = TestBed.createComponent(BuildCard);
    fixture.componentRef.setInput('build', { ...build, isOwn: false, isPublic: true });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('ของคุณ');
    expect(fixture.nativeElement.textContent).not.toContain('ส่วนตัว');
    expect(fixture.nativeElement.textContent).toContain('ใช้เป็นต้นแบบ Build');
  });
});

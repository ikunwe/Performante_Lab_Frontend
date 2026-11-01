import { TestBed } from '@angular/core/testing';
import { BuildCard } from './build-card';
import { vi } from 'vitest';
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
    fixture.componentRef.setInput('likeCount',42);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('ของคุณ');
    expect(fixture.nativeElement.querySelector('button[aria-label*="จำนวน 42"]')?.textContent).toContain('42');
    expect(text).toContain('ส่วนตัว');
    expect(text).toContain('ยังไม่ระบุ');
    expect(text).not.toContain('งบประมาณตัวอย่าง');
    expect(text).not.toContain('ใช้เป็นต้นแบบ Build');
    const usernameRow = fixture.nativeElement.querySelector('app-icon[name="user"]')?.parentElement?.parentElement;
    expect(usernameRow?.textContent).toContain('driver');
    expect(usernameRow?.textContent).toContain('ของคุณ');
    expect(usernameRow?.textContent).toContain('ส่วนตัว');
    const remove = vi.fn(); fixture.componentInstance.remove.subscribe(remove);
    const button = fixture.nativeElement.querySelector('button[aria-label="ลบ Build My Civic"]') as HTMLButtonElement;
    fixture.componentRef.setInput('busy',true); fixture.detectChanges(); button.click();
    expect(remove).not.toHaveBeenCalled();
    fixture.componentRef.setInput('busy',false); fixture.detectChanges(); button.click();
    expect(remove).toHaveBeenCalledWith(build);
  });
  it('keeps public community builds free of own/private badges', () => {
    TestBed.configureTestingModule({ imports: [BuildCard] });
    const fixture = TestBed.createComponent(BuildCard);
    fixture.componentRef.setInput('build', { ...build, isOwn: false, isPublic: true });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('ของคุณ');
    expect(fixture.nativeElement.textContent).not.toContain('ส่วนตัว');
    expect(fixture.nativeElement.textContent).toContain('ใช้เป็นต้นแบบ Build');
    expect(fixture.nativeElement.querySelector('button[aria-label^="ลบ Build"]')).toBeNull();
  });
});

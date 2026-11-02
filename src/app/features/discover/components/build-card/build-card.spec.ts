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
  it('shows the empty-photo icon for removed local covers or failed remote images and recovers for a new URL',()=>{
    const fixture=TestBed.createComponent(BuildCard);
    fixture.componentRef.setInput('build',{...build,image:'assets/List_Car/Honda/civic.png'});fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    fixture.componentRef.setInput('build',build);fixture.detectChanges();
    fixture.nativeElement.querySelector('img').dispatchEvent(new Event('error'));fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    fixture.componentRef.setInput('build',{...build,image:'https://example.com/new.png'});fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img')?.getAttribute('src')).toBe('https://example.com/new.png');
  });
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
    expect(text).not.toContain('งบประมาณ');
    expect(text).not.toContain('฿');
    expect(text).not.toContain('งบประมาณตัวอย่าง');
    expect(text).not.toContain('ใช้เป็นต้นแบบ Build');
    const usernameRow = fixture.nativeElement.querySelector('app-account-avatar')?.parentElement;
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
  it('renders the owner profile photo and falls back when it cannot load', () => {
    const fixture = TestBed.createComponent(BuildCard);
    fixture.componentRef.setInput('build', { ...build, authorAvatar: 'https://test/driver.png' });
    fixture.detectChanges();
    const avatar = fixture.nativeElement.querySelector('app-account-avatar img');
    expect(avatar?.getAttribute('src')).toBe('https://test/driver.png');
    expect(avatar?.getAttribute('alt')).toBe('driver');
    avatar.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-account-avatar img')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-account-avatar app-icon[name="user"]')).not.toBeNull();
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

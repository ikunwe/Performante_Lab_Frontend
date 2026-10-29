import { TestBed } from '@angular/core/testing';
import { AccountAvatar } from './account-avatar';

describe('Account setup badge', () => {
  it('shows yellow for incomplete/unknown, blue only when complete and hides on Profile', () => {
    const fixture = TestBed.createComponent(AccountAvatar);
    fixture.detectChanges();
    const badge = () =>
      fixture.nativeElement.querySelector('span[role="img"]') as HTMLElement | null;
    expect(badge()?.getAttribute('aria-label')).toContain('ยังตรวจสอบ');
    fixture.componentRef.setInput('complete', false);
    fixture.detectChanges();
    expect(badge()?.className).toContain('bg-amber-400');
    expect(badge()?.getAttribute('aria-label')).toContain('ไม่ครบ');
    fixture.componentRef.setInput('complete', true);
    fixture.detectChanges();
    expect(badge()?.className).toContain('bg-sky-400');
    fixture.componentRef.setInput('showStatus', false);
    fixture.detectChanges();
    expect(badge()).toBeNull();
  });
});

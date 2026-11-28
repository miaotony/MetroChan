import { expect, test as base } from '@playwright/test';

export { expect };
export const test = base.extend<{ runtimeGuard: void }>({
  runtimeGuard: [async ({ page }, use) => {
    const failures: string[] = [];
    page.on('pageerror', error => failures.push(error.message));
    page.on('response', response => {
      if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
    });
    await use();
    expect(failures, 'Uncaught page errors or failed asset requests').toEqual([]);
  }, { auto: true }],
});

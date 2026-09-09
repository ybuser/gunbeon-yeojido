export async function enterGuest(page) {
  const button = page.getByRole('button', { name: '회원가입 없이 체험하기', exact: true });
  if (await button.count()) await button.click();
}
export async function recordMenu(page, name, index) {
  const cards=page.locator('.saved-mission');
  const indices=index === undefined ? Array.from({length:await cards.count()},(_,i)=>i) : [index];
  for (const i of indices) {
    if (await page.getByRole('menu').count()) await page.keyboard.press('Escape');
    await cards.nth(i).getByRole('button', {name: /더보기$/}).click();
    const item=page.getByRole('menuitem',{name,exact:true});
    if (await item.count()) return item;
  }
  throw new Error('Record menu not found: '+name);
}

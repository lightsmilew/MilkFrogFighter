export async function openSetup(page){
  if(await page.locator('body').getAttribute('data-screen')==='home')await page.locator('#start-button:enabled').click();
  await page.locator('#setup-panel').waitFor({state:'visible'});
}
export async function launchMatch(page){
  await openSetup(page);await page.locator('#fight-button:enabled').click();
  await page.locator('body[data-screen="match"]').waitFor();
}

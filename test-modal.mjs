import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 1000
  });
  const page = await browser.newPage();

  // 브라우저 콘솔 로그 캡처
  page.on('console', msg => {
    console.log('🖥️  Browser console:', msg.text());
  });

  try {
    console.log('🌐 Opening test page...');
    await page.goto('http://localhost:3000/test-modal', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    console.log('📸 Taking initial screenshot...');
    await page.screenshot({ path: 'test-1-initial.png', fullPage: true });

    console.log('🖱️  Clicking first member button...');
    await page.locator('button').first().click();

    // 모달이 나타날 때까지 잠시 대기
    await page.waitForTimeout(500);

    console.log('📸 Taking modal screenshot (immediate)...');
    await page.screenshot({ path: 'test-2-modal-open.png', fullPage: true });

    // 모달 확인
    const hasModalNow = await page.evaluate(() => {
      return document.body.innerHTML.includes('닦달하기');
    });
    console.log('Has modal immediately after click:', hasModalNow);

    await page.waitForTimeout(2000);

    // DOM에서 fixed position 요소 찾기
    console.log('\n🔍 Checking for fixed position elements...');
    const fixedElements = await page.evaluate(() => {
      const elements = document.querySelectorAll('[style*="position: fixed"], [style*="position:fixed"]');
      return Array.from(elements).map(el => ({
        tagName: el.tagName,
        text: el.textContent?.substring(0, 50),
        style: el.getAttribute('style'),
        visible: el.offsetParent !== null,
        zIndex: window.getComputedStyle(el).zIndex
      }));
    });

    console.log('Fixed elements found:', fixedElements.length);
    fixedElements.forEach((el, i) => {
      console.log(`\nElement ${i + 1}:`);
      console.log('  Tag:', el.tagName);
      console.log('  Z-Index:', el.zIndex);
      console.log('  Visible:', el.visible);
      console.log('  Text:', el.text);
    });

    // selectedMember 상태 확인
    console.log('\n🔍 Checking React state...');
    const hasModal = await page.evaluate(() => {
      return document.body.innerHTML.includes('닦달하기');
    });
    console.log('Has 닦달하기 text:', hasModal);

    await page.waitForTimeout(3000);

    console.log('\n✅ Test completed! Check screenshots.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: 'test-error.png', fullPage: true });
  } finally {
    await browser.close();
  }
})();

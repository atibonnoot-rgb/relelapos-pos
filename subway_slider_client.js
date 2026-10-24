// subway_slider_client.js - Custom Responsive Subway Banner Slider
// Features: Zero cropping (620:330 ratio), Touch swiping, Auto-advance, Category jumping, Live admin sync

(function() {
  'use strict';

  let lastBannersHash = '';
  let sliderInterval = null;
  let currentSlideIndex = 0;

  function initSubwayCustomSlider(bannerCount) {
    const track = document.getElementById('subwaySliderTrack');
    const dots = document.querySelectorAll('.subway-slider-dot');
    if (!track || bannerCount <= 0) return;

    function goToSlide(idx) {
      currentSlideIndex = (idx + bannerCount) % bannerCount;
      track.style.transform = 'translateX(-' + (currentSlideIndex * 100) + '%)';
      dots.forEach((d, i) => {
        if (i === currentSlideIndex) d.classList.add('active');
        else d.classList.remove('active');
      });
    }

    dots.forEach(d => {
      d.onclick = function(e) {
        e.stopPropagation();
        const targetIdx = parseInt(d.dataset.index || '0', 10);
        goToSlide(targetIdx);
        resetAutoSlide();
      };
    });

    // Touch Swiping for mobile devices
    let touchStartX = 0;
    let touchEndX = 0;
    track.ontouchstart = function(e) {
      touchStartX = e.changedTouches[0].screenX;
    };
    track.ontouchend = function(e) {
      touchEndX = e.changedTouches[0].screenX;
      if (touchEndX < touchStartX - 35) {
        goToSlide(currentSlideIndex + 1);
        resetAutoSlide();
      } else if (touchEndX > touchStartX + 35) {
        goToSlide(currentSlideIndex - 1);
        resetAutoSlide();
      }
    };

    // Category click navigation
    document.querySelectorAll('.subway-slider-slide').forEach(s => {
      s.onclick = function() {
        const catId = s.dataset.category;
        if (catId) {
          const targetEl = document.getElementById('element-scroll-' + catId) || document.getElementById('recommended-item-1');
          if (targetEl) {
            const pos = targetEl.getBoundingClientRect().top + window.scrollY - 12;
            window.scrollTo({ top: pos, behavior: 'smooth' });
          }
        }
      };
    });

    function resetAutoSlide() {
      if (sliderInterval) clearInterval(sliderInterval);
      if (bannerCount > 1) {
        sliderInterval = setInterval(function() {
          goToSlide(currentSlideIndex + 1);
        }, 4500);
      }
    }
    resetAutoSlide();
  }

  async function syncStoreBannerSlider() {
    try {
      const res = await fetch('/api/merchant/external/21751/banners');
      if (!res.ok) return;
      const data = await res.json();
      if (!data || !data.promoBanners || !Array.isArray(data.promoBanners)) return;

      const banners = data.promoBanners;
      if (banners.length === 0) return;

      const hash = banners.map(b => b.url).join('||');
      if (hash === lastBannersHash) return;
      lastBannersHash = hash;

      const sliderBlock = document.querySelector('.store-header-main-wrapper .container .slider-block') || 
                          document.querySelector('.store-header-main-wrapper .slider-block') ||
                          document.querySelector('.slider-block');
      if (!sliderBlock) return;

      // Hide original dotpe React carousel
      const originalCarousel = sliderBlock.querySelector('.carousel-root:not(#subway-dynamic-carousel)');
      if (originalCarousel) {
        originalCarousel.style.display = 'none';
      }

      let customSlider = document.getElementById('subway-dynamic-carousel');
      if (!customSlider) {
        customSlider = document.createElement('div');
        customSlider.id = 'subway-dynamic-carousel';
        customSlider.className = 'subway-custom-carousel';
        sliderBlock.appendChild(customSlider);
      }

      let slidesHtml = '';
      banners.forEach((b, idx) => {
        const catId = b.bannerConfig && b.bannerConfig.objectId ? b.bannerConfig.objectId : '';
        slidesHtml += `
          <div class="subway-slider-slide" data-index="${idx}" data-category="${catId}">
            <div class="banner-img">
              <img src="${b.url}" alt="${b.title || 'Subway Special Promo'}" loading="${idx === 0 ? 'eager' : 'lazy'}" />
            </div>
          </div>
        `;
      });

      let dotsHtml = '';
      banners.forEach((_, idx) => {
        dotsHtml += `<div class="subway-slider-dot ${idx === 0 ? 'active' : ''}" data-index="${idx}"></div>`;
      });

      // Render track wrap and dots separately; no side arrows
      customSlider.innerHTML = `
        <div class="subway-slider-track-wrap">
          <div class="subway-slider-track" id="subwaySliderTrack">
            ${slidesHtml}
          </div>
        </div>
        ${banners.length > 1 ? `<div class="subway-slider-dots" id="subwaySliderDots">${dotsHtml}</div>` : ''}
      `;

      currentSlideIndex = 0;
      initSubwayCustomSlider(banners.length);
    } catch(e) {
      console.warn('Subway Slider Sync:', e.message);
    }
  }

  // Initial sync & ongoing dynamic poll
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncStoreBannerSlider);
  } else {
    syncStoreBannerSlider();
  }

  setInterval(syncStoreBannerSlider, 2500);
})();

/**
 * 墨屿书屋 · 前端增强（jQuery 4）
 * 只做渐进增强：动画、Toast、数量步进、二次确认。核心功能全部走表单与服务端。
 */
(function ($) {
    'use strict';

    $(function () {
        // 卡片逐个上浮淡入
        $('.book-card').each(function (i) {
            var el = this;
            setTimeout(function () { $(el).addClass('in'); }, Math.min(i * 55, 600));
        });
        $('.reveal').each(function (i) {
            var el = this;
            setTimeout(function () { $(el).addClass('in'); }, 80 + Math.min(i * 90, 500));
        });

        // 头部滚动收缩
        var $header = $('#site-header');
        var syncHeader = function () {
            $header.toggleClass('scrolled', $(window).scrollTop() > 12);
        };
        $(window).on('scroll', syncHeader);
        syncHeader();

        // 服务端一次性提示
        var $toast = $('#toast');
        if ($toast.text().trim() !== '') {
            $toast.addClass('show');
            setTimeout(function () { $toast.removeClass('show'); }, 2800);
        }

        // 数量步进
        $(document).on('click', '[data-qty-step]', function () {
            var step = parseInt($(this).attr('data-qty-step'), 10) || 0;
            var $row = $(this).closest('.qty');
            var $input = $row.find('input');
            var min = parseInt($input.attr('min'), 10);
            var max = parseInt($input.attr('max'), 10);
            var value = (parseInt($input.val(), 10) || 1) + step;

            if (!isNaN(max) && value > max) { value = max; }
            if (!isNaN(min) && value < min) { value = min; }
            $input.val(value);

            if ($input.data('autosubmit')) {
                $input.closest('form').trigger('submit');
            }
        });

        // 数量输入框只允许数字
        $(document).on('input', '.qty input', function () {
            this.value = this.value.replace(/[^\d]/g, '').slice(0, 3);
        });

        // 危险操作二次确认
        $(document).on('click', '[data-confirm]', function (e) {
            if (!window.confirm($(this).attr('data-confirm'))) {
                e.preventDefault();
            }
        });


        // 后台封面预览
        $(document).on('input', '#cover-input', function () {
            var value = this.value.trim();
            var $preview = $('#cover-preview');
            if (value === '') {
                $preview.css('background', 'linear-gradient(150deg, #3d4f6b, #263349)');
            } else if (/^(https?:\/\/|\/)/.test(value)) {
                $preview.css('background', '#fff').css('background-image', 'url("' + value + '")')
                    .css('background-size', 'cover').css('background-position', 'center');
            } else {
                $preview.css('background', value).css('background-image', 'none');
            }
        });
        // 提交后禁用按钮，避免重复下单
        $(document).on('submit', 'form[data-once]', function () {
            var $button = $(this).find('[type=submit]');
            $button.prop('disabled', true).text($button.data('loading') || '处理中…');
        });
    });
})(jQuery);

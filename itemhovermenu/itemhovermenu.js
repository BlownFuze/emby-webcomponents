﻿define(['layoutManager', 'connectionManager', 'itemHelper', 'mediaInfo', 'playbackManager', 'globalize', 'dom', 'apphost', 'css!./itemhovermenu', 'emby-button', 'emby-playstatebutton', 'emby-ratingbutton'], function (layoutManager, connectionManager, itemHelper, mediaInfo, playbackManager, globalize, dom, appHost) {
    'use strict';

    var preventHover = false;
    var showOverlayTimeout;

    function onPointerLeave(e) {

        var pointerType = e.pointerType || (layoutManager.mobile ? 'touch' : 'mouse');

        if (pointerType === 'mouse') {
            var elem = e.target;

            if (showOverlayTimeout) {
                clearTimeout(showOverlayTimeout);
                showOverlayTimeout = null;
            }

            elem = elem.classList.contains('cardOverlayTarget') ? elem : elem.querySelector('.cardOverlayTarget');

            if (elem) {
                slideDownToHide(elem);
            }
        }
    }

    function onSlideTransitionComplete() {
        this.classList.add('hide');
    }

    function slideDownToHide(elem) {

        if (elem.classList.contains('hide')) {
            return;
        }

        dom.addEventListener(elem, dom.whichTransitionEvent(), onSlideTransitionComplete, {
            once: true
        });

        elem.classList.remove('cardOverlayTarget-open');
    }

    function slideUpToShow(elem) {

        dom.removeEventListener(elem, dom.whichTransitionEvent(), onSlideTransitionComplete, {
            once: true
        });

        elem.classList.remove('hide');

        // force a reflow
        void elem.offsetWidth;

        elem.classList.add('cardOverlayTarget-open');
    }

    function getOverlayHtml(apiClient, item, card) {

        var html = '';

        html += '<div class="cardOverlayInner">';

        var className = card.className.toLowerCase();

        var isMiniItem = className.indexOf('mini') !== -1;
        var isSmallItem = isMiniItem || className.indexOf('small') !== -1;
        var isPortrait = className.indexOf('portrait') !== -1;

        var parentName = isSmallItem || isMiniItem || isPortrait ? null : item.SeriesName;
        var name = item.EpisodeTitle ? item.Name : itemHelper.getDisplayName(item);

        html += '<div>';
        var logoHeight = 26;
        var imgUrl;

        if (parentName && item.ParentLogoItemId) {

            imgUrl = apiClient.getScaledImageUrl(item.ParentLogoItemId, {
                maxHeight: logoHeight,
                type: 'logo',
                tag: item.ParentLogoImageTag
            });

            html += '<img src="' + imgUrl + '" style="max-height:' + logoHeight + 'px;max-width:100%;" />';

        }
        else if (item.ImageTags.Logo) {

            imgUrl = apiClient.getScaledImageUrl(item.Id, {
                maxHeight: logoHeight,
                type: 'logo',
                tag: item.ImageTags.Logo
            });

            html += '<img src="' + imgUrl + '" style="max-height:' + logoHeight + 'px;max-width:100%;" />';
        }
        else {
            html += parentName || name;
        }
        html += '</div>';

        if (parentName) {
            html += '<p>';
            html += name;
            html += '</p>';
        } else if (!isSmallItem && !isMiniItem) {
            html += '<div class="cardOverlayMediaInfo">';
            html += mediaInfo.getPrimaryMediaInfoHtml(item, {
                endsAt: false
            });
            html += '</div>';
        }

        html += '<div class="cardOverlayButtons">';

        if (playbackManager.canPlay(item)) {

            html += '<button is="emby-button" class="itemAction autoSize fab cardOverlayFab mini" data-action="resume"><i class="md-icon cardOverlayFab-md-icon">&#xE037;</i></button>';
        }

        if (item.LocalTrailerCount) {
            html += '<button title="' + globalize.translate('sharedcomponents#Trailer') + '" is="emby-button" class="itemAction autoSize fab cardOverlayFab mini" data-action="playtrailer"><i class="md-icon cardOverlayFab-md-icon">&#xE04B;</i></button>';
        }

        var moreIcon = appHost.moreIcon === 'dots-horiz' ? '&#xE5D3;' : '&#xE5D4;';
        html += '<button is="emby-button" class="itemAction autoSize fab cardOverlayFab mini" data-action="menu" data-playoptions="false"><i class="md-icon cardOverlayFab-md-icon">' + moreIcon + '</i></button>';

        var userData = item.UserData || {};

        if (itemHelper.canMarkPlayed(item)) {

            html += '<button is="emby-playstatebutton" type="button" data-action="none" class="itemAction fab cardOverlayFab mini" data-id="' + item.Id + '" data-serverid="' + item.ServerId + '" data-itemtype="' + item.Type + '" data-played="' + (userData.Played) + '"><i class="md-icon cardOverlayFab-md-icon">&#xE5CA;</i></button>';
        }

        if (itemHelper.canRate(item)) {

            var likes = userData.Likes == null ? '' : userData.Likes;

            html += '<button is="emby-ratingbutton" type="button" data-action="none" class="itemAction fab cardOverlayFab mini" data-id="' + item.Id + '" data-serverid="' + item.ServerId + '" data-itemtype="' + item.Type + '" data-likes="' + likes + '" data-isfavorite="' + (userData.IsFavorite) + '"><i class="md-icon cardOverlayFab-md-icon">&#xE87D;</i></button>';
        }

        html += '</div>';

        html += '</div>';

        return html;
    }

    function onCardOverlayButtonsClick(e) {

        var button = dom.parentWithClass(e.target, 'btnUserData');
        if (button) {
            e.stopPropagation();
        }
    }

    function onShowTimerExpired(elem) {

        var innerElem = elem.querySelector('.cardOverlayTarget');

        if (!innerElem) {
            innerElem = document.createElement('div');
            innerElem.classList.add('hide');
            innerElem.classList.add('cardOverlayTarget');

            // allow the overlay to be clicked to view the item
            innerElem.classList.add('itemAction');
            innerElem.setAttribute('data-action', 'link');

            var appendTo = elem.querySelector('div.cardContent') || elem.querySelector('.cardScalable') || elem.querySelector('.cardBox');

            //if (appendTo && appendTo.tagName == 'BUTTON') {
            //    appendTo = dom.parentWithClass(elem, 'cardScalable');
            //}

            if (!appendTo) {
                appendTo = elem;
            }

            appendTo.classList.add('withHoverMenu');
            appendTo.appendChild(innerElem);
        }

        var dataElement = dom.parentWithAttribute(elem, 'data-id');

        if (!dataElement) {
            return;
        }

        var id = dataElement.getAttribute('data-id');
        var type = dataElement.getAttribute('data-type');

        if (type === 'Timer' || type === 'SeriesTimer' || type === 'Program') {
            return;
        }

        var serverId = dataElement.getAttribute('data-serverid');

        var apiClient = connectionManager.getApiClient(serverId);

        apiClient.getItem(apiClient.getCurrentUserId(), id).then(function (item) {

            innerElem.innerHTML = getOverlayHtml(apiClient, item, dataElement);

            innerElem.querySelector('.cardOverlayButtons').addEventListener('click', onCardOverlayButtonsClick);
        });

        slideUpToShow(innerElem);
    }

    function onPointerEnter(e) {

        var pointerType = e.pointerType || (layoutManager.mobile ? 'touch' : 'mouse');

        if (pointerType === 'mouse') {
            var elem = e.target;
            var card = dom.parentWithClass(elem, 'cardBox');

            if (!card) {
                return;
            }

            if (preventHover === true) {
                preventHover = false;
                return;
            }

            if (showOverlayTimeout) {
                clearTimeout(showOverlayTimeout);
                showOverlayTimeout = null;
            }

            showOverlayTimeout = setTimeout(function () {
                onShowTimerExpired(card);

            }, 1600);
        }
    }

    function preventTouchHover() {
        preventHover = true;
    }

    function ItemHoverMenu(parentElement) {

        this.parent = parentElement;

        dom.addEventListener(this.parent, (window.PointerEvent ? 'pointerenter' : 'mouseenter'), onPointerEnter, {
            passive: true,
            capture: true
        });

        dom.addEventListener(this.parent, (window.PointerEvent ? 'pointerleave' : 'mouseleave'), onPointerLeave, {
            passive: true,
            capture: true
        });

        if (!window.PointerEvent) {

            // We only need this as a safeguard when pointer events are not supported
            dom.addEventListener(this.parent, "touchstart", preventTouchHover, {
                passive: true
            });
        }
    }

    ItemHoverMenu.prototype = {
        constructor: ItemHoverMenu,

        destroy: function () {

            dom.removeEventListener(this.parent, (window.PointerEvent ? 'pointerenter' : 'mouseenter'), onPointerEnter, {
                passive: true,
                capture: true
            });
            dom.removeEventListener(this.parent, (window.PointerEvent ? 'pointerleave' : 'mouseleave'), onPointerLeave, {
                passive: true,
                capture: true
            });

            dom.removeEventListener(this.parent, "touchstart", preventTouchHover, {
                passive: true
            });
        }
    };

    return ItemHoverMenu;
});
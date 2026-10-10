$(document).ready(() => {
    if (!isSadPanda()) {
        return
    }

    chrome.runtime.sendMessage({ action: 'sync' })
        .then((result) => {
            if (result && result.changed) {
                location.reload()
                return
            }
            showLogin(result && result.noAccess)
        })
        .catch(() => {
            showLogin(false)
        })
})

function isSadPanda() {
    if (document.contentType && document.contentType.indexOf('image/') === 0) {
        return true
    }

    if ($('img').filter((i, img) => img.src === document.URL).length) {
        return true
    }

    var body = document.body
    if (!body) {
        return true
    }

    return !body.innerText.trim() && !body.querySelector('img, iframe, video, canvas, input, form')
}

function addStyle(path) {
    $('<link>', { rel: 'stylesheet', href: chrome.runtime.getURL(path) })
        .appendTo(document.head || document.documentElement)
}

function showLogin(noAccess) {
    fetch(chrome.runtime.getURL('html/login.html'))
        .then((res) => res.text())
        .then((html) => {
            if (!document.body) {
                document.documentElement.appendChild(document.createElement('body'))
            }

            addStyle('css/bootstrap.min.css')
            addStyle('css/login.css')

            $('body').removeAttr('style').html(html)
            initLogin(noAccess)
        })
}

function toast(level, message) {
    var item = $('<div>')
        .addClass('sp-toast sp-toast-' + level)
        .text(message)
        .appendTo('#toasts')

    setTimeout(() => {
        item.css('opacity', 0)
        setTimeout(() => item.remove(), 300)
    }, 4000)
}

function clearLegacyStorage() {
    try {
        localStorage.removeItem('exh_user')
        localStorage.removeItem('exh_pass')
        localStorage.removeItem('exh_sddd')
    } catch (e) {
    }
}

function initLogin(noAccess) {
    var form = $('#login-form')
    var controls = form.find('input, button')
    var username = $('#username')
    var password = $('#password')
    var remember = $('#remember-me')

    $('#logo').attr('src', chrome.runtime.getURL('ico/128.png'))
    $('#github').attr('src', chrome.runtime.getURL('img/GitHub-Mark-Light-64px.png'))

    clearLegacyStorage()

    chrome.storage.local.get(['remember', 'username', 'password']).then((saved) => {
        if (saved.remember) {
            remember.prop('checked', true)
            username.val(saved.username || '')
            password.val(saved.password || '')
        }
        username.trigger('focus')
    })

    if (noAccess) {
        toast('error', 'Your account does not have access to ExHentai yet.')
    } else {
        toast('success', 'Ready!')
    }

    function setDisabled(disabled) {
        controls.prop('disabled', disabled)
    }

    function storageSave() {
        if (remember.prop('checked')) {
            return chrome.storage.local.set({
                remember: true,
                username: username.val(),
                password: password.val(),
            })
        }
        return chrome.storage.local.remove(['remember', 'username', 'password'])
    }

    form.on('submit', (e) => {
        e.preventDefault()
        setDisabled(true)

        chrome.runtime.sendMessage({
            action: 'login',
            username: username.val(),
            password: password.val(),
        })
            .then((result) => {
                if (result && result.ok) {
                    toast('success', 'You are now logged in!')
                    return storageSave().then(() => location.reload())
                }
                toast('error', (result && result.error) || 'Login failure!')
                setDisabled(false)
            })
            .catch(() => {
                toast('error', 'Unable to reach the extension, reload the page and try again.')
                setDisabled(false)
            })
    })
}

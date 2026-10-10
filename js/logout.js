$(document).ready(() => {
    exSignOut()
})

function exSignOut() {
    var menu = $('#nb')
    if (!menu.length || $('#haruhichanSignOut').length) {
        return
    }

    var first = menu.children().first()
    var item
    var link

    if (first.is('img')) {
        item = link = menu.children('a').first().clone()
        if (link.length) {
            menu.append(first.clone())
        }
    } else {
        item = first.clone()
        link = item.is('a') ? item : item.find('a').first()
    }

    if (!link.length) {
        return
    }

    link.text('Sign out')
        .attr('href', '#')
        .attr('id', 'haruhichanSignOut')
        .on('click', (e) => {
            e.preventDefault()
            chrome.runtime.sendMessage({ action: 'logout' })
                .finally(() => location.reload())
        })

    menu.append(item)
}

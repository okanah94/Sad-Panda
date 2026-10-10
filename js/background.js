const EX_URL = 'https://exhentai.org/'
const LOGIN_URL = 'https://forums.e-hentai.org/index.php?act=Login&CODE=01'
const LOGIN_PAGE = 'https://forums.e-hentai.org/index.php?act=Login&CODE=00'
const LOGOUT_COOKIES = ['yay', 'igneous', 'ipb_anonlogin', 'ipb_member_id', 'ipb_pass_hash', 'ipb_session_id']

chrome.runtime.onInstalled.addListener(() => {
	chrome.tabs.query({ url: '*://exhentai.org/*' }).then((tabs) => {
		tabs.forEach((tab) => chrome.tabs.reload(tab.id))
	})
})

function cookieExpireTime(cookie) {
	return cookie.expirationDate || Math.round(Date.now() / 1000) + 31536000
}

function cookieUrl(cookie) {
	return (cookie.secure ? 'https://' : 'http://') + cookie.domain.replace(/^\./, '') + cookie.path
}

function isHentaiCookie(cookie) {
	return cookie.name.indexOf('ipb_') !== -1 || cookie.name.indexOf('uconfig') !== -1
}

async function removeExCookie(name) {
	const cookie = await chrome.cookies.get({ url: EX_URL, name })
	if (cookie) {
		await chrome.cookies.remove({ url: EX_URL, name })
	}
	return cookie
}

async function setHentaiCookies() {
	const source = (await chrome.cookies.getAll({ domain: 'e-hentai.org' })).filter(isHentaiCookie)
	if (!source.some((cookie) => cookie.name === 'ipb_member_id')) {
		return { found: false, changed: false, retry: false }
	}

	let changed = false
	for (const cookie of source) {
		const current = await chrome.cookies.get({ url: EX_URL, name: cookie.name })
		if (current && current.value === cookie.value) {
			continue
		}
		await chrome.cookies.set({
			url: EX_URL,
			domain: '.exhentai.org',
			path: '/',
			name: cookie.name,
			value: cookie.value,
			secure: true,
			expirationDate: cookieExpireTime(cookie),
		})
		changed = true
	}

	if (changed) {
		await removeExCookie('yay')
		const igneous = await chrome.cookies.get({ url: EX_URL, name: 'igneous' })
		if (igneous && igneous.value === 'mystery') {
			await removeExCookie('igneous')
		}
		return { found: true, changed, retry: false }
	}

	const igneous = await removeExCookie('igneous')
	const yay = await removeExCookie('yay')
	return { found: true, changed, retry: !!(igneous || yay) }
}

async function hasHentaiLogin() {
	const member = await chrome.cookies.get({ url: 'https://e-hentai.org/', name: 'ipb_member_id' })
	const pass = await chrome.cookies.get({ url: 'https://e-hentai.org/', name: 'ipb_pass_hash' })
	return !!(member && member.value && member.value !== '0' && pass && pass.value)
}

async function setLoginHeaders() {
	try {
		await chrome.declarativeNetRequest.updateSessionRules({
			removeRuleIds: [1],
			addRules: [{
				id: 1,
				priority: 1,
				action: {
					type: 'modifyHeaders',
					requestHeaders: [
						{ header: 'Referer', operation: 'set', value: LOGIN_PAGE },
						{ header: 'Origin', operation: 'set', value: 'https://forums.e-hentai.org' },
					],
				},
				condition: {
					urlFilter: '|https://forums.e-hentai.org/index.php',
					tabIds: [chrome.tabs.TAB_ID_NONE],
				},
			}],
		})
	} catch (e) {
	}
}

function cleanText(html) {
	return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
}

function forumError(text) {
	const match = text.match(/The error returned was:\s*<\/h4>\s*<p>([\s\S]*?)<\/p>/i)
		|| text.match(/<div class="errorwrap">([\s\S]*?)<\/div>/i)
		|| text.match(/<span class="postcolor">([\s\S]*?)<\/span>/i)
	return match ? cleanText(match[1]) : ''
}

function pageTitle(text) {
	const match = text.match(/<title>([\s\S]*?)<\/title>/i)
	return match ? cleanText(match[1]) : ''
}

async function login(username, password) {
	const body = new URLSearchParams({
		referer: 'https://forums.e-hentai.org/index.php',
		b: '',
		bt: '',
		UserName: username,
		PassWord: password,
		CookieDate: '1',
	})

	await setLoginHeaders()

	let text
	let status
	try {
		const res = await fetch(LOGIN_URL, { method: 'POST', body, credentials: 'include' })
		status = res.status
		text = await res.text()
	} catch (e) {
		return { error: 'Error sending POST request to forums.e-hentai.org!' }
	}

	if (text.indexOf('Username or password incorrect') !== -1) {
		return { error: 'Login failure!' }
	}

	if (text.indexOf('You must already have registered for an account before you can log in') !== -1) {
		return { error: 'No account exists with name "' + username + '"' }
	}

	if (/captcha|g-recaptcha|h-captcha|cf-turnstile/i.test(text) && text.indexOf('You are now logged in as:') === -1) {
		return { error: 'e-hentai.org wants a captcha. Use the e-hentai.org link below to sign in there, then come back to this tab.' }
	}

	if (text.indexOf('You are now logged in as:') !== -1 || await hasHentaiLogin()) {
		const result = await setHentaiCookies()
		return result.found ? { ok: true } : { error: 'Unable to set cookies' }
	}

	const reason = forumError(text) || pageTitle(text)
	return { error: 'Unexpected login response (HTTP ' + status + (reason ? ': ' + reason : '') + '). Use the e-hentai.org link below to sign in there, then come back to this tab.' }
}

async function deleteAllCookies() {
	for (const domain of ['exhentai.org', 'e-hentai.org']) {
		const cookies = await chrome.cookies.getAll({ domain })
		await Promise.all(cookies
			.filter((cookie) => LOGOUT_COOKIES.indexOf(cookie.name) !== -1)
			.map((cookie) => chrome.cookies.remove({ url: cookieUrl(cookie), name: cookie.name, storeId: cookie.storeId })))
	}
	return { ok: true }
}

const handlers = {
	sync: () => setHentaiCookies(),
	login: (message) => login(String(message.username || ''), String(message.password || '')),
	logout: () => deleteAllCookies(),
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	const handler = handlers[message && message.action]
	if (!handler) {
		return false
	}

	handler(message, sender)
		.then(sendResponse)
		.catch((e) => sendResponse({ error: String((e && e.message) || e) }))
	return true
})

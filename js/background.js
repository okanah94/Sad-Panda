const EX_URL = 'https://exhentai.org/'
const LOGIN_URL = 'https://forums.e-hentai.org/index.php?act=Login&CODE=01'
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
		return { found: false, changed: false, noAccess: false }
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

	let noAccess = false
	if (changed) {
		await removeExCookie('yay')
		const igneous = await chrome.cookies.get({ url: EX_URL, name: 'igneous' })
		if (igneous && igneous.value === 'mystery') {
			await removeExCookie('igneous')
		}
	} else {
		const igneous = await chrome.cookies.get({ url: EX_URL, name: 'igneous' })
		noAccess = !!igneous && igneous.value === 'mystery'
	}

	return { found: true, changed, noAccess }
}

async function login(username, password) {
	const body = new URLSearchParams({
		referer: 'https://forums.e-hentai.org/index.php',
		UserName: username,
		PassWord: password,
		CookieDate: '1',
	})

	let text
	try {
		const res = await fetch(LOGIN_URL, { method: 'POST', body, credentials: 'include' })
		text = await res.text()
	} catch (e) {
		return { error: 'Error sending POST request to forums.e-hentai.org!' }
	}

	if (text.indexOf('You are now logged in as:') !== -1) {
		const result = await setHentaiCookies()
		return result.found ? { ok: true } : { error: 'Unable to set cookies' }
	}

	if (text.indexOf('Username or password incorrect') !== -1) {
		return { error: 'Login failure!' }
	}

	if (text.indexOf('You must already have registered for an account before you can log in') !== -1) {
		return { error: 'No account exists with name "' + username + '"' }
	}

	return { error: 'Unexpected login response. Log in at forums.e-hentai.org, then reload this page.' }
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

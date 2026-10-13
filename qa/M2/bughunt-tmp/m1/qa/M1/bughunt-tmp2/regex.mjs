import fs from 'node:fs';
const src = fs.readFileSync('sections/pf-review.js', 'utf8');
const EMAIL_RE = eval(src.match(/var EMAIL_RE = (\/.*\/[a-z]*);/)[1]);
const STORE_RE = eval(src.match(/var STORE_RE = (\/.*\/[a-z]*);/)[1]);
const emails = ['a@b..com', 'a@b.com.', 'a..b@shop.com', '.a@shop.com', 'a.@shop.com', 'a@-shop.com', 'a@shop.c0m', 'a@shop.xn--p1ai', 'a@b.co', 'a@b.c', 'first.last@sub.shop.io', "o'brien@shop.ie", 'a@[127.0.0.1]', 'ü@exämple.de', 'a@exa_mple.com', 'a@shop.com​', 'a@shop.123', 'a<b>@shop.com', 'a@shop.com,b@shop.com', 'me@gmail.com\n'];
const stores = ['shop.xn--p1ai', 'магазин.рф', 'shop.com:8080/x', 'shop.com?ref=x', 'shop.com.', '-shop.com', 'shop.com/😀', 'https://shop.com:99999', 'localhost:3000', 'shop.co.uk#x', 'HTTPS://SHOP.COM', 'ftp://shop.com', '192.168.0.1', 'shop.com​', 'shop.com/a b', 'shop.c0m', 'user@shop.com', 'shop.com:', 'http://shop.com:/x', 'shop.123'];
console.log('EMAIL'); for (const e of emails) console.log(JSON.stringify(e), EMAIL_RE.test(e));
console.log('STORE'); for (const s of stores) console.log(JSON.stringify(s), STORE_RE.test(s));
// ReDoS probe
for (const [n, re, s] of [['email', EMAIL_RE, 'a@' + 'b.'.repeat(5000) + '!'], ['store', STORE_RE, 'a.'.repeat(5000) + '!'], ['email2', EMAIL_RE, 'a'.repeat(50000) + '@']]) { const t = Date.now(); re.test(s); console.log('redos', n, Date.now() - t, 'ms'); }

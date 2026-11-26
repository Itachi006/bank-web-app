/*
 * In-browser demo of the Bank Web App REST API (used ONLY for the GitHub Pages build).
 *
 * GitHub Pages can only host static files, so it cannot run the Spring Boot + JDBC backend.
 * This script replaces window.fetch for /api/* calls and re-implements the same endpoints, JSON shapes,
 * error messages and business rules as BankController / BankService, storing data in localStorage.
 * The real app (mvn spring-boot:run, Docker, Render) never loads this file: the Pages workflow injects it
 * into a COPY of the static folder.
 */
(function () {
  'use strict';
  var KEY = 'bank_demo_db_v1';
  var MAX = 9999999999.99;

  function now() {
    var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' +
           p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  function seed() {
    var t = now();
    return {
      nextAccount: 3, nextTxn: 3, sessions: {},
      accounts: {
        1: { id: 1, name: 'Demo User', pin: '1234', cents: 500000 },
        2: { id: 2, name: 'Friend Account', pin: '4321', cents: 100000 }
      },
      txns: [
        { txnId: 1, accountId: 1, type: 'DEPOSIT', cents: 500000, description: 'Initial account deposit', timestamp: t },
        { txnId: 2, accountId: 2, type: 'DEPOSIT', cents: 100000, description: 'Initial account deposit', timestamp: t }
      ]
    };
  }

  var db;
  try { db = JSON.parse(localStorage.getItem(KEY)) || seed(); } catch (e) { db = seed(); }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* private mode */ } }

  function BankError(msg, status) { this.message = msg; this.status = status || 400; }
  var bad = function (m) { return new BankError(m, 400); };
  var money = function (c) { return c / 100; };
  var plain = function (c) { return (c / 100).toFixed(2); };

  function checkAmount(a) {
    if (a === null || a === undefined || typeof a !== 'number' || isNaN(a) || a <= 0) throw bad('Amount must be greater than zero.');
    if (Math.abs(a * 100 - Math.round(a * 100)) > 1e-6) throw bad('Amount can have at most 2 decimal places.');
    if (a > MAX) throw bad('Amount is too large.');
    return Math.round(a * 100);
  }

  function log(accountId, type, cents, description) {
    db.txns.push({ txnId: db.nextTxn++, accountId: accountId, type: type, cents: cents, description: description, timestamp: now() });
  }

  function session(req) {
    var h = req.headers.Authorization || '';
    var id = h.indexOf('Bearer ') === 0 ? db.sessions[h.slice(7)] : null;
    if (!id || !db.accounts[id]) throw new BankError('Please log in again.', 401);
    return db.accounts[id];
  }

  var routes = {
    'POST /api/accounts': function (req) {
      var b = req.body, name = b.holderName;
      if (!name || !String(name).trim() || String(name).length > 100) throw bad('Account holder name is required (max 100 characters).');
      if (typeof b.pin !== 'string' || !/^\d{4}$/.test(b.pin)) throw bad('PIN must be exactly 4 digits.');
      var cents = 0;
      if (b.initialDeposit) {
        if (b.initialDeposit < 0) throw bad('Initial deposit cannot be negative.');
        cents = checkAmount(b.initialDeposit);
      }
      var id = db.nextAccount++;
      db.accounts[id] = { id: id, name: String(name).trim(), pin: b.pin, cents: cents };
      if (cents > 0) log(id, 'DEPOSIT', cents, 'Initial account deposit');
      return [201, { accountId: id, message: 'Account created. Your account number is ' + id }];
    },
    'POST /api/login': function (req) {
      var b = req.body;
      if (!b.accountId) throw bad('Account number is required.');
      var a = db.accounts[b.accountId];
      if (!a || a.pin !== b.pin) throw bad('Invalid account number or PIN.');
      var token = 'demo-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      db.sessions[token] = a.id;
      return [200, { token: token, accountId: a.id, holderName: a.name }];
    },
    'POST /api/logout': function (req) {
      var h = req.headers.Authorization || '';
      if (h.indexOf('Bearer ') === 0) delete db.sessions[h.slice(7)];
      return [200, { message: 'Logged out.' }];
    },
    'GET /api/me': function (req) {
      var a = session(req);
      return [200, { accountId: a.id, holderName: a.name, balance: money(a.cents) }];
    },
    'POST /api/me/deposit': function (req) {
      var a = session(req), c = checkAmount(req.body.amount);
      a.cents += c; log(a.id, 'DEPOSIT', c, 'Cash/Online Deposit');
      return [200, { balance: money(a.cents), message: 'Deposit successful.' }];
    },
    'POST /api/me/withdraw': function (req) {
      var a = session(req), c = checkAmount(req.body.amount);
      if (a.cents < c) throw bad('Insufficient funds. Available balance: ' + plain(a.cents));
      a.cents -= c; log(a.id, 'WITHDRAWAL', c, 'Cash Withdrawal');
      return [200, { balance: money(a.cents), message: 'Withdrawal successful.' }];
    },
    'POST /api/me/transfer': function (req) {
      var from = session(req), toId = req.body.toAccountId;
      if (!toId) throw bad('Recipient account number is required.');
      if (from.id === Number(toId)) throw bad('You cannot transfer money to your own account.');
      var c = checkAmount(req.body.amount), to = db.accounts[toId];
      if (!to) throw bad('Recipient account #' + toId + ' does not exist.');
      if (from.cents < c) throw bad('Insufficient funds. Available balance: ' + plain(from.cents));
      from.cents -= c; to.cents += c;
      log(from.id, 'TRANSFER_OUT', c, 'Transfer to Account #' + to.id);
      log(to.id, 'TRANSFER_IN', c, 'Transfer from Account #' + from.id);
      return [200, { balance: money(from.cents), message: 'Transfer successful.' }];
    },
    'GET /api/me/transactions': function (req) {
      var a = session(req);
      return [200, db.txns.filter(function (t) { return t.accountId === a.id; })
        .sort(function (x, y) { return y.txnId - x.txnId; })
        .map(function (t) { return { txnId: t.txnId, type: t.type, amount: money(t.cents), description: t.description, createdAt: t.timestamp.replace(' ', 'T') }; })];
    }
  };

  var realFetch = window.fetch.bind(window);
  window.fetch = function (url, opts) {
    var m = /\/api(\/[^?#]*)?(?:[?#].*)?$/.exec(String(url));
    if (!m) return realFetch(url, opts);
    opts = opts || {};
    var path = '/api' + (m[1] || '');
    var handler = routes[(opts.method || 'GET').toUpperCase() + ' ' + path];
    return new Promise(function (resolve) {
      setTimeout(function () {
        var status = 200, data;
        try {
          if (!handler) throw new BankError('Not found.', 404);
          var body = {};
          try { body = opts.body ? JSON.parse(opts.body) : {}; } catch (e) { throw bad('Invalid input. Please check the values entered.'); }
          var out = handler({ body: body, headers: opts.headers || {} });
          status = out[0]; data = out[1]; save();
        } catch (e) {
          if (!(e instanceof BankError)) { console.error(e); e = new BankError('Server error. Please try again.', 500); }
          status = e.status; data = { error: e.message };
        }
        resolve(new Response(JSON.stringify(data), { status: status, headers: { 'Content-Type': 'application/json' } }));
      }, 120);
    });
  };

  // Demo banner
  var bar = document.createElement('div');
  bar.style.cssText = 'background:#eef2ff;color:#3730a3;border-bottom:1px solid #c7d2fe;padding:8px 14px;font:13px/1.4 system-ui,sans-serif;text-align:center';
  bar.innerHTML = '<b>Live demo</b> · runs in your browser, data saved locally · Try account <b>1</b> / PIN <b>1234</b> (or open a new account) · ' +
    '<a href="#" id="demoReset" style="color:#4f46e5">Reset demo</a>';
  document.body.insertBefore(bar, document.body.firstChild);
  document.getElementById('demoReset').addEventListener('click', function (e) {
    e.preventDefault();
    try { localStorage.removeItem(KEY); sessionStorage.removeItem('token'); } catch (x) { /* ignore */ }
    location.reload();
  });
})();

const config = require("../../src/config/config");

const loginCredentialsFormat = ({
  name,
  email,
  password,
  isExistingUser,
}) => {
  const accountSection = isExistingUser
    ? `
      <tr>
        <td class="label">📧 Email</td>
        <td class="value">${email}</td>
      </tr>
      <tr>
        <td class="label">🔒 Password</td>
        <td class="value">Your existing password</td>
      </tr>
    `
    : `
      <tr>
        <td class="label">📧 Email</td>
        <td class="value">${email}</td>
      </tr>
      <tr>
        <td class="label">🔒 Password</td>
        <td class="value">${password}</td>
      </tr>
    `;

  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Access</title>

  <style>
      body{
          margin:0;
          padding:0;
          font-family:'Segoe UI',Arial,Helvetica,sans-serif;
          background:#eef8f9;
          -webkit-font-smoothing:antialiased;
      }

      .wrapper{
          width:100%;
          padding:40px 16px;
      }

      .container{
          max-width:600px;
          margin:auto;
          background:#ffffff;
          border-radius:20px;
          overflow:hidden;
          box-shadow:0 10px 30px rgba(23,148,166,.18);
      }

      .header{
          position:relative;
          background:linear-gradient(135deg,#23b8cb 0%,#1a9aab 100%);
          padding:44px 30px 40px;
          text-align:center;
          overflow:hidden;
      }

      .header::before{
          content:"";
          position:absolute;
          top:-60px;
          right:-40px;
          width:160px;
          height:160px;
          background:rgba(255,255,255,.08);
          border-radius:50%;
      }

      .header::after{
          content:"";
          position:absolute;
          bottom:-50px;
          left:-30px;
          width:120px;
          height:120px;
          background:rgba(255,255,255,.06);
          border-radius:50%;
      }

      .welcome-badge{
          display:inline-block;
          background:rgba(255,255,255,.18);
          border:1px solid rgba(255,255,255,.35);
          color:#fff;
          font-size:12px;
          font-weight:700;
          letter-spacing:.5px;
          text-transform:uppercase;
          padding:6px 16px;
          border-radius:20px;
          margin-bottom:16px;
      }

      .header h1{
          color:#fff;
          margin:0;
          font-size:28px;
          font-weight:800;
          letter-spacing:1.5px;
          position:relative;
      }

      .header span.sub{
          color:rgba(255,255,255,.9);
          font-size:13px;
          display:block;
          margin-top:8px;
          font-weight:500;
          position:relative;
      }

      .body{
          padding:36px 34px 30px;
      }

      .greeting{
          font-size:19px;
          font-weight:800;
          color:#111;
          margin:0 0 12px;
      }

      .body p{
          font-size:14.5px;
          line-height:23px;
          color:#555;
          margin:0 0 14px;
      }

      .section-title{
          font-size:12.5px;
          font-weight:800;
          color:#23b8cb;
          text-transform:uppercase;
          letter-spacing:.6px;
          margin:30px 0 14px;
          display:flex;
          align-items:center;
      }

      .section-title::after{
          content:"";
          flex:1;
          height:1px;
          background:#dff3f6;
          margin-left:10px;
      }

      .account-table{
          width:100%;
          border-collapse:collapse;
          background:#f6fcfd;
          border:1px solid #d7f0f3;
          border-radius:12px;
          overflow:hidden;
      }

      .account-table td{
          padding:14px 18px;
          font-size:14px;
      }

      .account-table tr:not(:last-child) td{
          border-bottom:1px solid #e2f3f5;
      }

      .account-table .label{
          color:#6b8b90;
          font-weight:600;
          width:110px;
      }

      .account-table .value{
          color:#111;
          font-weight:700;
      }

      .note{
          font-size:12.5px;
          color:#8a9a9c;
          margin:12px 4px 0;
      }

      .features{
          margin:0;
          padding:6px 20px;
          list-style:none;
          background:#f6fcfd;
          border:1px solid #e5f5f7;
          border-radius:12px;
      }

      .features li{
          line-height:26px;
          padding:8px 0;
          font-size:14px;
          color:#333;
          border-bottom:1px solid #eaf6f8;
          display:flex;
          align-items:center;
      }

      .features li:last-child{
          border-bottom:none;
      }

      .features .ico{
          margin-right:10px;
          font-size:16px;
      }

      .dashboard-cta{
          text-align:center;
          margin:32px 0 14px;
      }

      .dashboard-cta a{
          background:#111;
          color:#fff !important;
          text-decoration:none;
          padding:14px 34px;
          border-radius:30px;
          display:inline-block;
          font-weight:700;
          font-size:14px;
      }

      .help-text{
          text-align:center;
          font-size:13px;
          color:#7a8a8c;
      }

      .help-text a{
          color:#23b8cb;
          text-decoration:none;
          font-weight:600;
      }

      .footer{
          padding:24px 30px;
          text-align:center;
          border-top:1px solid #eef8f9;
          background:#fafffe;
      }

      .footer .brand{
          color:#23b8cb;
          font-weight:800;
          font-size:14px;
          margin:0 0 4px;
      }

      .tagline{
          font-size:11px;
          color:#b7c6c8;
          margin:0;
      }

      @media (max-width:600px){
          .wrapper{ padding:16px 8px; }
          .container{ border-radius:14px; }
          .body,.header{ padding:28px 22px; }
      }
  </style>

  </head>

  <body>

  <div class="wrapper">

  <div class="container">

      <div class="header">
          <div class="welcome-badge">Welcome to Access 💫</div>
          <h1>ACCESS</h1>
          <span class="sub">by Glamlink</span>
      </div>

      <div class="body">

          <p class="greeting">Hey ${name || "there"}! 👋</p>

          <p>
              Welcome to Access by Glamlink! Your account has been successfully
              created and your Access profile is ready to shine.
          </p>

          <div class="section-title">Your Account</div>

          <table class="account-table">
              ${accountSection}
          </table>

          ${
            isExistingUser
              ? `<p class="note">Forgot your password? Just use the <strong>"Forgot Password"</strong> option on the login page.</p>`
              : `<p class="note">Please keep these credentials safe. You can change your password anytime after logging in.</p>`
          }

          <div class="section-title">What's Next?</div>

          <ul class="features">
              <li><span class="ico">✨</span> Update your profile anytime</li>
              <li><span class="ico">📸</span> Add new photos and videos</li>
              <li><span class="ico">💇</span> Edit your specialties and bio</li>
              <li><span class="ico">🔗</span> Update your booking links</li>
              <li><span class="ico">🚀</span> Share your Access profile instantly</li>
              <li><span class="ico">📱</span> Connect using your NFC card or QR code</li>
          </ul>

          <div class="dashboard-cta">
              <a href="https://glamlink.net/dashboard" target="_blank">
                  Access Your Dashboard →
              </a>
          </div>

          <p class="help-text">
              Need help?
              <a href="mailto:support@glamlink.net">support@glamlink.net</a>
          </p>

      </div>

      <div class="footer">
          <p class="brand">${config.app_name || "Glamlink"}</p>
          <p class="tagline">Everything people want to know about you. One tap away. ✨</p>
      </div>

  </div>

  </div>

  </body>
  </html>`;
};


module.exports = {
  loginCredentialsFormat,
};

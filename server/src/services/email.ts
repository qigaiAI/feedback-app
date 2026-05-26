import crypto from 'crypto';
import https from 'https';

const SECRET_ID = process.env.TENCENT_SECRET_ID!;
const SECRET_KEY = process.env.TENCENT_SECRET_KEY!;
const TEMPLATE_ID = parseInt(process.env.SES_TEMPLATE_ID || '0');

function sha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data).digest();
}

function tc3Request(action: string, params: Record<string, any>): Promise<any> {
  const service = 'ses';
  const host = 'ses.tencentcloudapi.com';
  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);

  const payload = JSON.stringify(params);
  const canonicalRequest = [
    'POST', '/', '',
    `content-type:application/json\nhost:${host}\n`,
    'content-type;host',
    sha256(payload),
  ].join('\n');

  const credentialScope = `${date}/${service}/tc3_request`;
  const stringToSign = [
    'TC3-HMAC-SHA256', String(timestamp), credentialScope, sha256(canonicalRequest),
  ].join('\n');

  const kDate = hmacSha256(`TC3${SECRET_KEY}`, date);
  const kService = hmacSha256(kDate, service);
  const kSigning = hmacSha256(kService, 'tc3_request');
  const signature = hmacSha256(kSigning, stringToSign).toString('hex');
  const authorization = `TC3-HMAC-SHA256 Credential=${SECRET_ID}/${credentialScope}, SignedHeaders=content-type;host, Signature=${signature}`;

  const body = JSON.stringify(params);

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: host, port: 443, method: 'POST',
      headers: {
        'Content-Type': 'application/json', 'Host': host,
        'X-TC-Action': action, 'X-TC-Version': '2020-10-02',
        'X-TC-Timestamp': String(timestamp), 'X-TC-Region': 'ap-guangzhou',
        'Authorization': authorization,
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const result = JSON.parse(data);
        if (result.Response?.Error) {
          reject(new Error(result.Response.Error.Message));
        } else {
          resolve(result.Response);
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

export async function sendVerificationCode(email: string, code: string) {
  await tc3Request('SendEmail', {
    FromEmailAddress: process.env.SMTP_USER!,
    Destination: [email],
    Subject: '课后反馈助手 - 邮箱验证码',
    Template: {
      TemplateID: TEMPLATE_ID,
      TemplateData: JSON.stringify({ code }),
    },
  });
}

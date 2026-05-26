import crypto from 'crypto';
import https from 'https';

function sha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function sign(secretKey: string, date: string, service: string, str: string): string {
  const kDate = crypto.createHmac('sha256', `TC3${secretKey}`).update(date).digest();
  const kService = crypto.createHmac('sha256', kDate).update(service).digest();
  const kSigning = crypto.createHmac('sha256', kService).update('tc3_request').digest();
  return crypto.createHmac('sha256', kSigning).update(str).digest('hex');
}

async function sesRequest(action: string, params: Record<string, any>): Promise<any> {
  const secretId = process.env.TENCENT_SECRET_ID || '';
  const secretKey = process.env.TENCENT_SECRET_KEY || '';
  const endpoint = 'ses.ap-guangzhou.tencentcloudapi.com';
  const service = 'ses';
  const version = '2020-10-02';
  const region = 'ap-guangzhou';

  const payload = JSON.stringify(params);
  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);

  const hashedPayload = sha256(payload);
  const canonicalHeaders = `content-type:application/json\nhost:${endpoint}\n`;
  const signedHeaders = 'content-type;host';
  const canonicalRequest = `POST\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${hashedPayload}`;

  const algorithm = 'TC3-HMAC-SHA256';
  const credentialScope = `${date}/${service}/tc3_request`;
  const hashedCanonicalRequest = sha256(canonicalRequest);
  const stringToSign = `${algorithm}\n${timestamp}\n${credentialScope}\n${hashedCanonicalRequest}`;

  const signature = sign(secretKey, date, service, stringToSign);

  const authorization = `${algorithm} Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: endpoint,
      port: 443,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Host': endpoint,
        'X-TC-Action': action,
        'X-TC-Version': version,
        'X-TC-Timestamp': timestamp.toString(),
        'X-TC-Region': region,
        'Authorization': authorization,
      },
      // Bypass proxy by using a fresh agent
      agent: new https.Agent({ keepAlive: false }),
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data.Response.Error) {
            reject(new Error(data.Response.Error.Message));
          } else {
            resolve(data.Response);
          }
        } catch {
          reject(new Error(`Parse error: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

export async function sendVerificationCode(email: string, code: string): Promise<boolean> {
  try {
    await sesRequest('SendEmail', {
      FromEmailAddress: process.env.SMTP_USER || 'noreply@ai-feedback.tech',
      Destination: [email],
      Template: {
        TemplateID: Number(process.env.SES_TEMPLATE_ID || '49155'),
        TemplateData: JSON.stringify({ code }),
      },
      Subject: '验证码 - 课后反馈助手',
      TriggerType: 1,
    });
    console.log(`Verification code sent to ${email}`);
    return true;
  } catch (err: any) {
    console.error('Tencent SES send error:', err.message || err);
    return false;
  }
}

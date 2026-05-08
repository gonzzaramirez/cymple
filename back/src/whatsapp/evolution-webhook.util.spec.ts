import { extractInboundText } from './evolution-webhook.util';

describe('extractInboundText', () => {
  it('extrae texto inbound y lo marca como estructurado', () => {
    const payload = {
      data: {
        key: {
          fromMe: false,
          remoteJid: '5491122334455@s.whatsapp.net',
        },
        message: {
          conversation: '1',
        },
      },
    };

    const inbound = extractInboundText(payload);
    expect(inbound).not.toBeNull();
    expect(inbound).toMatchObject({
      text: '1',
      fromJid: '5491122334455',
      isStructuredText: true,
      previewText: '1',
    });
  });

  it('clasifica multimedia como no estructurado y genera preview', () => {
    const payload = {
      data: {
        key: {
          fromMe: false,
          remoteJid: '5491166677788@s.whatsapp.net',
        },
        message: {
          imageMessage: {
            mimetype: 'image/jpeg',
          },
        },
      },
    };

    const inbound = extractInboundText(payload);
    expect(inbound).not.toBeNull();
    expect(inbound).toMatchObject({
      fromJid: '5491166677788',
      isStructuredText: false,
      mediaType: 'imageMessage',
      previewText: 'Nuevo archivo multimedia recibido (imageMessage)',
    });
  });
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      erro: "Método não permitido."
    });
  }

  try {
    const accessToken = process.env.PAGBANK_TOKEN;
    const appUrl = process.env.APP_URL;
    const ambiente = process.env.PAGBANK_ENV || "SANDBOX";

    if (!accessToken) {
      return res.status(500).json({
        erro: "Token do PagBank não configurado no Vercel."
      });
    }

    if (!appUrl) {
      return res.status(500).json({
        erro: "APP_URL não configurado no Vercel."
      });
    }

    const catalogo = {
      1: {
        titulo: "Convite de Aniversário",
        preco: 9.90
      },
      2: {
        titulo: "Topo de Bolo",
        preco: 8.90
      },
      3: {
        titulo: "Cartão Especial",
        preco: 5.90
      },
      4: {
        titulo: "Arquivo para Imprimir",
        preco: 10.90
      }
    };

    const itensRecebidos = Array.isArray(req.body?.items)
      ? req.body.items
      : [];

    if (itensRecebidos.length === 0) {
      return res.status(400).json({
        erro: "Carrinho vazio."
      });
    }

    const items = itensRecebidos.map((item) => {
      const produto = catalogo[Number(item.produtoId)];

      if (!produto) {
        throw new Error(
          `Produto inválido: ${item.produtoId}`
        );
      }

      return {
        reference_id: String(item.produtoId),
        name: produto.titulo,
        quantity: 1,
        unit_amount: Math.round(produto.preco * 100)
      };
    });

    const checkout = {
      reference_id: `VALLSENA-${Date.now()}`,

      items: items,

      redirect_url: `${appUrl}/?pagamento=sucesso`,

      return_url: appUrl,

      notification_urls: [
        `${appUrl}/api/notificacao`
      ],

      payment_notification_urls: [
        `${appUrl}/api/notificacao`
      ]
    };

    const apiUrl =
      ambiente === "PROD"
        ? "https://api.pagseguro.com/checkouts"
        : "https://sandbox.api.pagseguro.com/checkouts";

    const resposta = await fetch(apiUrl, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Bearer ${accessToken}`
      },

      body: JSON.stringify(checkout)
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
      console.error("Erro PagBank:", dados);

      return res.status(resposta.status).json({
        erro:
          dados.message ||
          dados.error ||
          "Erro ao criar checkout no PagBank."
      });
    }

    const linkPagamento = Array.isArray(dados.links)
      ? dados.links.find(
          (link) => link.rel === "PAY"
        )
      : null;

    if (!linkPagamento || !linkPagamento.href) {
      return res.status(500).json({
        erro: "O PagBank não retornou o link de pagamento."
      });
    }

    return res.status(200).json({
      url: linkPagamento.href,
      checkout_id: dados.id
    });

  } catch (erro) {
    console.error("Erro interno:", erro);

    return res.status(500).json({
      erro:
        erro.message ||
        "Erro interno ao criar pagamento."
    });
  }
}

export default async function handler(req, res) {
  // Aceita somente POST
  if (req.method !== "POST") {
    return res.status(405).json({
      erro: "Método não permitido."
    });
  }

  try {
    // Variáveis configuradas no Vercel
    const accessToken = process.env.PAGBANK_TOKEN;
    const appUrl = process.env.APP_URL;
    const ambiente = process.env.PAGBANK_ENV || "SANDBOX";

    // Verifica o token
    if (!accessToken) {
      return res.status(500).json({
        erro: "Token do PagBank não configurado."
      });
    }

    // Verifica a URL do site
    if (!appUrl) {
      return res.status(500).json({
        erro: "APP_URL não configurado."
      });
    }

    // Catálogo de produtos
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

    // Produtos enviados pelo site
    const itensRecebidos = Array.isArray(req.body?.items)
      ? req.body.items
      : [];

    if (itensRecebidos.length === 0) {
      return res.status(400).json({
        erro: "Carrinho vazio."
      });
    }

    // Monta os produtos para o PagBank
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
        description: "Arte personalizada Vall Sena",
        quantity: 1,
        unit_amount: Math.round(produto.preco * 100)
      };
    });

    // Dados do Checkout PagBank
    const checkout = {
      reference_id: `VALLSENA-${Date.now()}`,

      items,

      redirect_url: `${appUrl}/?pagamento=sucesso`,

      return_url: appUrl,

      notification_urls: [
        `${appUrl}/api/notificacao`
      ],

      payment_notification_urls: [
        `${appUrl}/api/notificacao`
      ]
    };

    // Ambiente PagBank
    const apiUrl =
      ambiente === "PROD"
        ? "https://api.pagseguro.com/checkouts"
        : "https://sandbox.api.pagseguro.com/checkouts";

    // Cria o Checkout
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

    // Trata erros do PagBank
    if (!resposta.ok) {
      console.error("Erro PagBank:", dados);

      return res.status(resposta.status).json({
        erro:
          dados.message ||
          dados.error ||
          "Erro ao criar checkout no PagBank.",
        detalhes: dados
      });
    }

    // Procura o link de pagamento
    const linkPagamento = Array.isArray(dados.links)
      ? dados.links.find((link) => link.rel === "PAY")
      : null;

    if (!linkPagamento?.href) {
      return res.status(500).json({
        erro: "PagBank não retornou o link de pagamento.",
        resposta: dados
      });
    }

    // Retorna o link para o seu site
    return res.status(200).json({
      url: linkPagamento.href,
      checkout_id: dados.id
    });

  } catch (erro) {
    console.error("Erro:", erro);

    return res.status(500).json({
      erro:
        erro.message ||
        "Erro interno ao criar pagamento."
    });
  }
}

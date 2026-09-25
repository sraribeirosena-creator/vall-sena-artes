export default async function handler(req, res) {
  // Aceita somente POST
  if (req.method !== "POST") {
    return res.status(405).json({
      erro: "Método não permitido."
    });
  }

  try {
    // Variáveis configuradas no Vercel
    const accessToken = process.env.MP_ACCESS_TOKEN;
    const appUrl = process.env.APP_URL;
    const ambiente = process.env.MP_ENV || "TESTE";

    // Verifica o Access Token
    if (!accessToken) {
      return res.status(500).json({
        erro: "Token de acesso do Mercado Pago não configurado."
      });
    }

    // Verifica a URL do site
    if (!appUrl) {
      return res.status(500).json({
        erro: "APP_URL não definido."
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

    // Recebe os produtos enviados pelo site
    const itensRecebidos =
      Array.isArray(req.body?.items)
        ? req.body.items
        : [];

    if (itensRecebidos.length === 0) {
      return res.status(400).json({
        erro: "Carrinho vazio."
      });
    }

    // Monta os itens para o Mercado Pago
    const items = itensRecebidos.map((item) => {
      const produto = catalogo[Number(item.produtoId)];

      if (!produto) {
        throw new Error(
          `Produto inválido: ${item.produtoId}`
        );
      }

      return {
        id: String(item.produtoId),
        title: produto.titulo,
        description: "Arte personalizada Vall Sena",
        quantity: 1,
        currency_id: "BRL",
        unit_price: Number(produto.preco)
      };
    });

    // Cria a preferência de pagamento
    const preferencia = {
      items,

      external_reference:
        `VALLSENA-${Date.now()}`,

      back_urls: {
        success:
          `${appUrl}/?pagamento=sucesso`,

        pending:
          `${appUrl}/?pagamento=pendente`,

        failure:
          `${appUrl}/?pagamento=falhou`
      },

      auto_return: "approved"
    };

    // Envia para o Mercado Pago
    const resposta = await fetch(
      "https://api.mercadopago.com/checkout/preferences",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },

        body: JSON.stringify(preferencia)
      }
    );

    const dados = await resposta.json();

    // Trata erro do Mercado Pago
    if (!resposta.ok) {
      return res.status(resposta.status).json({
        erro:
          dados.message ||
          dados.error ||
          "Erro ao criar pagamento no Mercado Pago."
      });
    }

    // Escolhe o link de pagamento
    const url =
      ambiente === "PROD"
        ? dados.init_point
        : (dados.sandbox_init_point || dados.init_point);

    if (!url) {
      return res.status(500).json({
        erro: "Mercado Pago não retornou o link de pagamento."
      });
    }

    // Retorna o link para o site
    return res.status(200).json({
      url,
      preference_id: dados.id
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

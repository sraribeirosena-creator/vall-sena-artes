export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      erro: "Método não permitido."
    });
  }

  const accessToken = process.env.MP_ACCESS_TOKEN;
  const appUrl = process.env.APP_URL;
  const ambiente = process.env.MP_ENV || "TEST";

  if (!accessToken) {
    return res.status(500).json({
      erro: "Token de acesso do Mercado Pago não configurado."
    });
  }

  if (!appUrl) {
    return res.status(500).json({
      erro: "APP_URL não definido."
    });
  }

  const catalogo = {
    1: { titulo: "Convite de Aniversário", preco: 9.90 },
    2: { titulo: "Convite de Casamento", preco: 14.90 },
    3: { titulo: "Kit Festa Completo", preco: 19.90 },
    4: { titulo: "Figurinhas WhatsApp", preco: 7.90 },
    5: { titulo: "Artes para Histórias", preco: 8.90 },
    6: { titulo: "Etiquetas Personalizadas", preco: 6.90 },
    7: { titulo: "Lembrancinhas", preco: 14.90 },
    8: { titulo: "Topo de Bolo", preco: 8.90 },
    9: { titulo: "Cartão Especial", preco: 5.90 },
    10: { titulo: "Arquivo para Imprimir", preco: 10.90 }
  };

  try {
    const items = Array.isArray(req.body?.items)
      ? req.body.items
      : [];

    if (!items.length) {
      return res.status(400).json({
        erro: "Carrinho vazio."
      });
    }

    const itensMercadoPago = items.map((item) => {
      const produto = catalogo[Number(item.produtoId)];

      if (!produto) {
        throw new Error("Produto inválido.");
      }

      return {
        id: String(item.produtoId),
        title: produto.titulo,
        description: "Arte personalizada Vall Sena",
        quantity: 1,
        currency_id: "BRL",
        unit_price: produto.preco
      };
    });

    const baseUrl = appUrl.replace(/\/$/, "");

    const preferencia = {
      items: itensMercadoPago,

      external_reference: `VALLSENA-${Date.now()}`,

      back_urls: {
        success: `${baseUrl}/?pagamento=sucesso`,
        pending: `${baseUrl}/?pagamento=pendente`,
        failure: `${baseUrl}/?pagamento=falhou`
      },

      auto_return: "approved"
    };

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

    if (!resposta.ok) {
      return res.status(resposta.status).json({
        erro:
          dados.message ||
          dados.error ||
          "Erro no Mercado Pago."
      });
    }

    const url =
      ambiente === "PROD"
        ? dados.init_point
        : (dados.sandbox_init_point || dados.init_point);

    if (!url) {
      return res.status(500).json({
        erro: "Mercado Pago não retornou o link de pagamento."
      });
    }

    return res.status(200).json({
      url,
      preference_id: dados.id
    });

  } catch (erro) {
    return res.status(500).json({
      erro: erro.message || "Erro interno ao criar pagamento."
    });
  }
}


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
        erro: "Token PagBank não configurado."
      });
    }

    if (!appUrl || !appUrl.startsWith("https://")) {
      return res.status(500).json({
        erro: "APP_URL inválido ou não configurado."
      });
    }

    const catalogo = {
      1: { titulo: "Convite de Aniversário", preco: 9.90 },
      2: { titulo: "Convite de Casamento", preco: 14.90 },
      3: { titulo: "Kit Festa Completo", preco: 19.90 },
      4: { titulo: "Figurinhas WhatsApp", preco: 7.90 },
      5: { titulo: "Artes para Stories", preco: 8.90 },
      6: { titulo: "Etiquetas Personalizadas", preco: 6.90 },
      7: { titulo: "Lembrancinhas", preco: 12.90 },
      8: { titulo: "Topo de Bolo", preco: 8.90 },
      9: { titulo: "Cartão Especial", preco: 5.90 },
      10: { titulo: "Arquivo para Imprimir", preco: 10.90 }
    };

    const recebidos = Array.isArray(req.body?.itens)
      ? req.body.itens
      : Array.isArray(req.body?.items)
        ? req.body.items
        : [];

    if (!recebidos.length) {
      return res.status(400).json({
        erro: "Carrinho vazio."
      });
    }

    const items = recebidos.map((item) => {
      const id = Number(
  item.produtoId ?? item.productId ?? item.id
);
      const produto = catalogo[id];

      if (!produto) {
        throw new Error(`Produto inválido: ${id}`);
      }

      return {
        reference_id: String(id),
        name: produto.titulo,
        quantity: 1,
        unit_amount: Math.round(produto.preco * 100)
      };
    });

    const baseUrl = appUrl.replace(/\/+$/, "");

    const checkout = {
      reference_id: `VALLSENA-${Date.now()}`,
      items,
      redirect_url: `${baseUrl}/?pagamento=retorno`,
      return_url: baseUrl
    };

    const apiUrl = ambiente === "PROD"
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

    const textoResposta = await resposta.text();

    let dados = {};

    try {
      dados = textoResposta ? JSON.parse(textoResposta) : {};
    } catch {
      console.error("Resposta inválida PagBank:", textoResposta);

      return res.status(502).json({
        erro: "Resposta inválida do PagBank.",
        detalhes: textoResposta
      });
    }

    
if (!resposta.ok) {
  console.error("ERRO PAGBANK DETALHADO:", {
    status: resposta.status,
    statusText: resposta.statusText,
    respostaOriginal: textoResposta,
    contentType: resposta.headers.get("content-type"),
    requestId: resposta.headers.get("x-request-id")
  });

  return res.status(502).json({
    erro: "Erro ao criar checkout no PagBank.",
    status: resposta.status,
    detalhes: textoResposta || "Resposta vazia do PagBank."
  });
}

      console.error("ERRO PAGBANK:", {
        status: resposta.status,
        resposta: dados
      });

      return res.status(502).json({
        erro: "Erro ao criar checkout no PagBank.",
        status: resposta.status,
        detalhes: dados
      });
    }

    const linkPagamento = dados.links?.find(
      link => link.rel === "PAY"
    );

    if (!linkPagamento?.href) {
      console.error("Link de pagamento ausente:", dados);

      return res.status(502).json({
        erro: "PagBank não retornou o link de pagamento.",
        detalhes: dados
      });
    }

    return res.status(200).json({
      url: linkPagamento.href,
      checkout_id: dados.id
    });

  } catch (erro) {
    console.error("Erro interno:", erro);

    return res.status(500).json({
      erro: erro.message || "Erro interno ao criar pagamento."
    });
  }
}

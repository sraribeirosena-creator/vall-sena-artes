
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

    if (!appUrl) {
      return res.status(500).json({
        erro: "APP_URL não configurado."
      });
    }

    // Catálogo oficial da loja
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

    // Aceita os dois nomes usados pelo site
    const itensRecebidos = Array.isArray(req.body?.itens)
      ? req.body.itens
      : Array.isArray(req.body?.items)
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
} catch (erro) {
  console.error("Resposta inválida do PagBank:", textoResposta);

  return res.status(502).json({
    erro: "O PagBank retornou uma resposta inválida.",
    detalhes: textoResposta
  });
}


    
if (!resposta.ok) {
  console.error("ERRO PAGBANK:", {
    status: resposta.status,
    statusText: resposta.statusText,
    resposta: textoResposta,
    dados: dados
  });

  return res.status(502).json({
    erro: "Erro ao criar checkout no PagBank.",
    status: resposta.status,
    detalhes: textoResposta || "Resposta vazia do PagBank."
  });
}

      console.error("Erro PagBank:", dados);

      return res.status(resposta.status).json({
        erro: dados.message ||
          dados.error ||
          "Erro ao criar checkout no PagBank."
      });
    }

    const linkPagamento = dados.links?.find(
      (link) => link.rel === "PAY"
    );

    if (!linkPagamento?.href) {
      return res.status(500).json({
        erro: "PagBank não retornou o link de pagamento."
      });
    }

    return res.status(200).json({
      url: linkPagamento.href,
      checkout_id: dados.id
    });

  } catch (erro) {
    console.error("Erro interno:", erro);

    return res.status(500).json({
      erro: erro.message ||
        "Erro interno ao criar pagamento."
    });
  }
}

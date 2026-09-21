import type { Db } from '../db/client'
import type { ProductCreateInput } from './product.schema'

/**
 * Catalogo inicial. Precos e descricoes plausiveis, porque o enunciado pede
 * dados reais no banco, e sao os registros que aparecem no Prisma Studio e nas
 * chamadas do Insomnia. As imagens apontam para um servico publico de fotos de
 * exemplo, entao o front consegue renderizar o card sem upload de arquivo.
 */
export const PRODUTOS_INICIAIS: ProductCreateInput[] = [
  {
    title: 'Teclado mecanico ABNT2 tenkeyless',
    description:
      'Teclado 87 teclas com switch marrom, estrutura de aluminio e cabo USB-C removivel. Layout brasileiro com tecla de cedilha.',
    price: '349.90',
    imageUrl: 'https://picsum.photos/seed/teclado-mecanico/640/480',
  },
  {
    title: 'Monitor IPS 27 polegadas 100 Hz',
    description:
      'Painel IPS de 27 polegadas em 2560x1440, 100 Hz, com entrada HDMI 2.0 e DisplayPort 1.2 e suporte com ajuste de altura.',
    price: '1499.00',
    imageUrl: 'https://picsum.photos/seed/monitor-ips/640/480',
  },
  {
    title: 'SSD NVMe 1 TB PCIe 4.0',
    description:
      'Unidade M.2 2280 com leitura sequencial de 5000 MB/s e cinco anos de garantia. Compativel com notebook e desktop.',
    price: '529.90',
    imageUrl: 'https://picsum.photos/seed/ssd-nvme/640/480',
  },
  {
    title: 'Mouse sem fio 2.4 GHz silencioso',
    description:
      'Mouse de seis botoes com sensor optico de 4000 DPI, clique silencioso e autonomia de doze meses com uma pilha AA.',
    price: '89.90',
    imageUrl: 'https://picsum.photos/seed/mouse-sem-fio/640/480',
  },
  {
    title: 'Cadeira de escritorio com apoio lombar',
    description:
      'Cadeira giratoria com tela respiravel, apoio lombar ajustavel, bracos 3D e base de nylon reforcada para ate 120 kg.',
    price: '1189.00',
    imageUrl: 'https://picsum.photos/seed/cadeira-escritorio/640/480',
  },
  {
    title: 'Headset USB com cancelamento de ruido',
    description:
      'Headset over-ear com microfone unidirecional, cancelamento de ruido ativo e conexao USB-A com controle de volume no cabo.',
    price: '279.90',
    imageUrl: 'https://picsum.photos/seed/headset-usb/640/480',
  },
]

/**
 * Limpa e repovoa a tabela, para que rodar o seed duas vezes nao duplique
 * registro. Tudo em uma transacao: ou o catalogo inteiro entra, ou nada muda.
 *
 * A insercao e um create por registro em vez de createMany porque createMany
 * nao tem o mesmo suporte nos dois providers, e seis registros nao pedem
 * otimizacao.
 */
export async function seedProducts(db: Db): Promise<number> {
  const inseridos = await db.$transaction(async (tx) => {
    await tx.product.deleteMany()

    for (const produto of PRODUTOS_INICIAIS) {
      await tx.product.create({ data: produto })
    }

    return PRODUTOS_INICIAIS.length
  })

  return inseridos
}

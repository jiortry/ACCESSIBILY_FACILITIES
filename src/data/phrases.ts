export type PhraseCategory = {
  name: string;
  items: string[];
};

export const SEED_PHRASES: PhraseCategory[] = [
  {
    name: "Saluti",
    items: [
      "ciao a tutti, benvenuti nel server",
      "buona partita",
      "gg wp",
      "a dopo, vado a minare",
    ],
  },
  {
    name: "Mob",
    items: ["creeper alle spalle!", "scheletro sul tetto", "zombie in arrivo", "enderman vicino"],
  },
  {
    name: "Risorse",
    items: [
      "ho trovato diamanti",
      "qualcuno ha del ferro?",
      "mi servono assi di legno",
      "raccolgo cibo per tutti",
    ],
  },
  {
    name: "Costruzioni",
    items: [
      "sto costruendo una casa",
      "passami i blocchi di pietra",
      "facciamo un portale per il Nether",
      "sto scavando una miniera",
    ],
  },
  {
    name: "Combattimento",
    items: ["attenzione al boss", "copertemi le spalle", "ho perso tutto, torno alla base", "evoco il Wither tra poco"],
  },
  {
    name: "Coordinate",
    items: ["vieni alle mie coordinate", "marca questo punto", "torno allo spawn", "vado al villaggio"],
  },
];

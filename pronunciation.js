/* English-friendly botanical pronunciation approximations. Capitals indicate stress.
 * Pronunciation varies by region. These are reading aids, not identification changes.
 * Reference: https://plants.ces.ncsu.edu/ (Phonetic Spelling on plant profiles).
 * Common-name aliases intentionally supply genus only, never an unconfirmed species.
 */
(() => {
  "use strict";
  const words = {
  "Codiaeum": "koh-dee-EE-um",
  "variegatum": "vair-ee-eh-GAY-tum",
  "Beaucarnea": "boh-KAR-nee-uh",
  "recurvata": "ree-kur-VAY-tuh",
  "Mammillaria": "mam-ih-LAIR-ee-uh",
  "Dionaea": "dy-oh-NEE-uh",
  "muscipula": "muh-SIP-yoo-luh",
  "Chamaedorea": "kam-ee-DOR-ee-uh",
  "elegans": "ELL-eh-ganz",
  "Guzmania": "guz-MAY-nee-uh",
  "Aloe": "AL-oh",
  "vera": "VEER-uh",
  "Dracaena": "druh-SEE-nuh",
  "marginata": "mar-jih-NAY-tuh",
  "Jacobaea": "jak-oh-BEE-uh",
  "maritima": "muh-RIT-ih-muh",
  "Senecio": "sen-EE-see-oh",
  "cineraria": "sin-eh-RAIR-ee-uh",
  "Strelitzia": "streh-LIT-see-uh",
  "Anthurium": "an-THUR-ee-um",
  "Fittonia": "fit-TOH-nee-uh",
  "Philodendron": "fil-oh-DEN-drun",
  "Spathiphyllum": "spath-ih-FIL-um",
  "Pachira": "puh-KEER-uh",
  "Epipremnum": "ep-ih-PREM-num",
  "Phalaenopsis": "fal-eh-NOP-sis",
  "Calathea": "kal-uh-THEE-uh",
  "Goeppertia": "gep-PER-tee-uh",
  "Pilea": "PY-lee-uh",
  "Tradescantia": "trad-es-KAN-tee-uh",
  "pallida": "PAL-ih-duh",
  "Sempervivum": "sem-per-VEE-vum",
  "hederaceum": "hed-er-AY-see-um",
  "Crassothonna": "krass-oh-THON-uh",
  "capensis": "kuh-PEN-sis",
  "Plectranthus": "plek-TRAN-thus",
  "ciliatus": "sil-ee-AY-tus",
  "Alternanthera": "al-ter-NAN-ther-uh",
  "Haworthiopsis": "hay-wor-thee-OP-sis",
  "attenuata": "at-ten-yoo-AY-tuh",
  "sanderiana": "san-der-ee-AY-nuh",
  "Syngonium": "sin-GOH-nee-um",
  "Tillandsia": "til-LAND-see-uh",
  "Phlebodium": "flee-BOH-dee-um",
  "aureum": "AW-ree-um",
  "involucrata": "in-vol-yoo-KRAY-tuh",
  "Monstera": "mon-STAIR-uh",
  "deliciosa": "deh-liss-ee-OH-suh",
  "Zamioculcas": "zam-ee-oh-KUL-kas",
  "zamiifolia": "zam-ee-ih-FOH-lee-uh",
  "Plerandra": "pleh-RAN-druh",
  "elegantissima": "el-ee-gan-TISS-ih-muh",
  "Curio": "KYOOR-ee-oh",
  "barbertonicus": "bar-ber-TON-ih-kus",
  "zebrina": "zeh-BREE-nuh",
  "Aglaonema": "ag-lay-oh-NEE-muh",
  "Cissus": "SIS-us",
  "alata": "uh-LAY-tuh",
  "Pelargonium": "pel-ar-GOH-nee-um",
  "Chlorophytum": "klor-oh-FY-tum",
  "comosum": "koh-MOH-sum"
};
  const aliases = {
    "Bird of Paradise": "Strelitzia",
    "Money Tree": "Pachira",
    "Marble Queen Pothos": "Epipremnum",
    "Gold Dust Croton": "Codiaeum",
    "Moth Orchid": "Phalaenopsis",
    "Aluminum Plant": "Pilea"
  };
  window.gaiaBotanicalPronunciation = species => {
    const original = String(species || "");
    const source = aliases[original] || original;
    // Ignore cultivar names, qualifiers and common names; keep known Latin words.
    const tokens = source.replace(/['‘][^'’]*['’]/g, "").match(/[A-Za-z]+/g) || [];
    const entries = tokens.filter(word => Object.hasOwn(words, word))
      .map(word => ({name: word, pronunciation: words[word]}));
    return {entries, genusOnly: Boolean(aliases[original])};
  };
})();

/* GAIA botanical field guide. Read-only general references; personal care stays in plants.json. */
(() => {
  "use strict";
  // Entries are shared by plants with the same taxon, so information is maintained once.
  // A genus-level reference is not a claim that a particular species or cultivar was identified.
  const taxa = {
    croton: {taxon:"Codiaeum variegatum",family:"Euphorbiaceae",habit:"Evergreen tropical shrub",native:"Malesia to the southwestern Pacific",trait:"Cultivars are prized for patterned leaves in many colors; leaf color and shape vary by cultivar.",propagation:"Stem cuttings"},
    ponytail: {taxon:"Beaucarnea recurvata",family:"Asparagaceae",habit:"Caudex-forming tree, not a true palm",native:"Mexico",trait:"The swollen base stores water, and long, narrow leaves arch from a woody crown.",propagation:"Seed; occasional basal offsets"},
    mammillaria: {taxon:"Mammillaria",family:"Cactaceae",habit:"Spiny, water-storing cactus",trait:"Mammillaria produce spines from small tubercles rather than continuous ribs; exact species needs confirmation.",propagation:"Offsets when produced, or seed"},
    flytrap: {taxon:"Dionaea muscipula",family:"Droseraceae",habit:"Temperate carnivorous perennial",trait:"Each hinged trap is a modified leaf. The plant normally undergoes winter dormancy.",propagation:"Division, seed, or specialist leaf-pull methods"},
    parlor: {taxon:"Chamaedorea elegans",family:"Arecaceae",habit:"Slow-growing understory palm",trait:"Fine, arching fronds develop on slender stems. It is a genuine palm, not a fern.",propagation:"Seed"},
    guzmania: {taxon:"Guzmania",family:"Bromeliaceae",habit:"Tropical rosette-forming bromeliad",trait:"The colorful display is usually formed by bracts. A mature rosette flowers once and can produce offsets ('pups').",propagation:"Offsets or pups"},
    aloe: {taxon:"Aloe vera",family:"Asphodelaceae",habit:"Clumping, water-storing succulent",trait:"Fleshy leaves hold water in a central rosette; mature plants may produce pups.",propagation:"Basal offsets"},
    dragon: {taxon:"Dracaena",family:"Asparagaceae",habit:"Woody tropical foliage plant",trait:"The dragon tree's narrow leaves cluster at the ends of woody canes; 'Magenta' is a horticultural selection.",propagation:"Stem or tip cuttings"},
    dusty: {taxon:"Jacobaea maritima",family:"Asteraceae",habit:"Silvery-leaved perennial/subshrub",trait:"Leaf surfaces are covered with fine pale hairs, giving the 'dusty' appearance.",propagation:"Stem cuttings or seed"},
    strelitzia: {taxon:"Strelitzia",family:"Strelitziaceae",habit:"Large clumping perennial",trait:"Bird-of-paradise plants have broad, paddle-like leaves; flower and mature size depend on the species.",propagation:"Division or seed"},
    anthurium: {taxon:"Anthurium",family:"Araceae",habit:"Tropical aroid",trait:"The colored 'flower' is generally a spathe surrounding a spadix bearing many tiny flowers.",propagation:"Division, stem cuttings or seed, depending on type"},
    fittonia: {taxon:"Fittonia",family:"Acanthaceae",habit:"Low-growing tropical groundcover",trait:"Leaf veins contrast strongly with the blade; the plant often wilts visibly when too dry.",propagation:"Stem cuttings"},
    ringfire: {taxon:"Philodendron",family:"Araceae",habit:"Climbing tropical aroid",trait:"'Ring of Fire' has deeply lobed leaves and variable variegation; the exact hybrid parentage should not be inferred from its trade name.",propagation:"Stem cuttings containing a node"},
    peace: {taxon:"Spathiphyllum",family:"Araceae",habit:"Clumping tropical understory perennial",trait:"White or pale spathes surround a flower spike; the plant is not a true lily.",propagation:"Division"},
    pachira: {taxon:"Pachira",family:"Malvaceae",habit:"Tropical tree commonly trained as a houseplant",trait:"Pachira aquatica is the familiar commercial money tree, but this record does not establish an exact botanical identification.",propagation:"Seed or stem cuttings"},
    pothos: {taxon:"Epipremnum aureum",family:"Araceae",habit:"Climbing or trailing aroid vine",trait:"'Marble Queen' is a variegated selection; its white leaf areas contain less chlorophyll.",propagation:"Stem cuttings with at least one node"},
    orchid: {taxon:"Phalaenopsis",family:"Orchidaceae",habit:"Epiphytic orchid",trait:"Silvery aerial roots often turn greener when wet; flower spikes emerge from the leaf crown's sides.",propagation:"Occasional keikis or specialist seed culture"},
    prayer: {taxon:"Goeppertia / Calathea",family:"Marantaceae",habit:"Tropical rhizomatous foliage plant",trait:"Many prayer-plant relatives adjust the angle of their leaves over the daily light cycle.",propagation:"Division"},
    aluminum: {taxon:"Pilea cadierei",family:"Urticaceae",habit:"Tropical herbaceous foliage plant",trait:"Raised silver markings give the foliage an aluminum-like shine; species assignment should be confirmed if needed.",propagation:"Stem cuttings"},
    purpleheart: {taxon:"Tradescantia pallida",family:"Commelinaceae",habit:"Trailing succulent-stemmed perennial",trait:"Strong light encourages the distinctive purple pigmentation.",propagation:"Stem cuttings"},
    sempervivum: {taxon:"Sempervivum",family:"Crassulaceae",habit:"Rosette-forming alpine succulent",trait:"Mother rosettes produce daughter offsets ('chicks'); flowering rosettes die after bloom.",propagation:"Detach rooted offsets"},
    heartleaf: {taxon:"Philodendron hederaceum",family:"Araceae",habit:"Climbing tropical aroid vine",trait:"Heart-shaped juvenile leaves enlarge and change as the vine matures and climbs.",propagation:"Node cuttings"},
    ruby: {taxon:"Crassothonna capensis",family:"Asteraceae",habit:"Trailing succulent",native:"Cape Provinces, South Africa",trait:"Slender stems carry small bead-like leaves; leaf color can intensify in strong light.",propagation:"Stem cuttings"},
    plectranthus: {taxon:"Plectranthus",family:"Lamiaceae",habit:"Soft-stemmed spreading or trailing herb",trait:"This mint-family relative has textured foliage and can branch readily after a trim. The species is still tentative.",propagation:"Stem cuttings"},
    alternanthera: {taxon:"Alternanthera",family:"Amaranthaceae",habit:"Colorful herbaceous foliage plant",trait:"Leaf pigmentation makes many cultivated joyweeds popular as ornamental bedding plants.",propagation:"Stem cuttings"},
    haworthiopsis: {taxon:"Haworthiopsis",family:"Asphodelaceae",habit:"Slow-growing rosette succulent",trait:"Raised white markings can form 'zebra' stripes; several species look alike and require careful identification.",propagation:"Offsets"},
    luckybamboo: {taxon:"Dracaena sanderiana",family:"Asparagaceae",habit:"Tropical cane-forming shrub",trait:"Despite the name, lucky bamboo is a dracaena, not a true bamboo.",propagation:"Cane or tip cuttings"},
    syngonium: {taxon:"Syngonium",family:"Araceae",habit:"Climbing or trailing aroid vine",trait:"Young leaves are often arrow-shaped and can develop a different shape as the plant matures.",propagation:"Stem cuttings with a node"},
    tillandsia: {taxon:"Tillandsia",family:"Bromeliaceae",habit:"Mostly epiphytic bromeliad",trait:"Leaf scales (trichomes) absorb moisture; most forms grow without potting soil.",propagation:"Offsets or seed"},
    bluestar: {taxon:"Phlebodium aureum",family:"Polypodiaceae",habit:"Epiphytic fern",native:"Southeastern United States and the Caribbean through tropical South America",trait:"Blue-green fronds emerge from creeping, fuzzy rhizomes; as a fern it reproduces by spores, not flowers.",propagation:"Rhizome division"},
    friendship: {taxon:"Pilea",family:"Urticaceae",habit:"Compact textured-leaf tropical herb",trait:"The quilted leaf texture is characteristic of many friendship-plant cultivars; exact species needs confirmation.",propagation:"Stem cuttings"},
    monstera: {taxon:"Monstera deliciosa",family:"Araceae",habit:"Climbing tropical aroid vine",trait:"Mature leaves can develop splits and holes (fenestrations). 'Thai Constellation' is a variegated selection.",propagation:"Stem cuttings with a viable node"},
    zz: {taxon:"Zamioculcas zamiifolia",family:"Araceae",habit:"Rhizomatous tropical perennial",trait:"Thick rhizomes store water; 'Raven' develops very dark foliage as leaves mature.",propagation:"Division or leaf cuttings (slow)"},
    falsearalia: {taxon:"Plerandra elegantissima",family:"Araliaceae",habit:"Woody tropical shrub/tree",native:"Southeastern New Caledonia",trait:"Young foliage has slender, finely divided leaflets and can differ noticeably from mature leaves.",propagation:"Stem cuttings or seed"},
    curio: {taxon:"Curio",family:"Asteraceae",habit:"Shrubby succulent",trait:"The narrow fleshy leaves are adapted to storing water; exact species is not verified in this record.",propagation:"Stem cuttings"},
    zebrina: {taxon:"Tradescantia zebrina",family:"Commelinaceae",habit:"Creeping or trailing perennial",trait:"Striped leaves often show purple beneath; stems root readily at their nodes.",propagation:"Stem cuttings"},
    aglaonema: {taxon:"Aglaonema",family:"Araceae",habit:"Tropical evergreen understory perennial",trait:"'Siam Aurora' is selected for green leaves with red-pink margins and veins.",propagation:"Division or stem cuttings"},
    cissus: {taxon:"Cissus alata",family:"Vitaceae",habit:"Climbing or trailing grape-family vine",trait:"Despite the common name, grape ivy belongs to the grape family, not to true ivy (Hedera).",propagation:"Stem cuttings"},
    pelargonium: {taxon:"Pelargonium",family:"Geraniaceae",habit:"Aromatic herbaceous subshrub",trait:"Scented leaves release oils when brushed; the 'citronella' trade name does not establish mosquito-control effectiveness.",propagation:"Stem cuttings"},
    nanouk: {taxon:"Tradescantia",family:"Commelinaceae",habit:"Trailing succulent-stemmed ornamental",trait:"'Nanouk' is selected for pink, cream and green foliage; the trade cultivar label is not a full species identification.",propagation:"Stem cuttings"},
    spider: {taxon:"Chlorophytum comosum",family:"Asparagaceae",habit:"Clumping perennial with arching leaves",trait:"Mature plants often form hanging plantlets on runners, especially in favorable growing conditions.",propagation:"Root the runner plantlets or divide"}
  };
  const byPlant = {
    "01":"croton","02":"ponytail","03":"mammillaria","04":"flytrap","05":"parlor","06":"guzmania",
    "07":"aloe","08":"dragon","09":"dusty","10":"strelitzia","11":"anthurium","12":"fittonia",
    "13":"ringfire","14":"peace","15":"pachira","16":"pothos","17":"croton","18":"orchid",
    "19":"prayer","20":"aluminum","21":"purpleheart","22":"sempervivum","23":"guzmania",
    "24":"heartleaf","25":"ruby","26":"plectranthus","27":"alternanthera","28":"haworthiopsis",
    "29":"luckybamboo","30":"syngonium","31":"tillandsia","32":"bluestar","33":"plectranthus",
    "34":"plectranthus","35":"friendship","36":"monstera","37":"monstera","38":"monstera",
    "39":"zz","40":"falsearalia","41":"curio","42":"zebrina","43":"aglaonema","44":"cissus",
    "45":"pelargonium","46":"nanouk","47":"haworthiopsis","48":"spider"
  };
  window.GAIA_SPECIES_GUIDE = Object.freeze({taxa,byPlant});
})();

/* GAIA learning library: horticultural types and botanical families.
 * Type = a practical collection label, not a taxonomic rank.
 * Family = a botanical relationship, NOT a universal watering recipe.
 * Editorial references: RHS houseplant guidance and Kew POWO family descriptions.
 */
(() => {
  "use strict";
  const types = {
    "air-plant": {
      about:"An air plant usually anchors to a tree, rock, or other support instead of growing in conventional potting soil. The term describes a growth habit, not a single family.",
      recognize:"Leaves may have silvery water-absorbing scales (trichomes); Tillandsia often makes a rosette and later produces offsets.",
      conditions:"Bright, filtered light and strong airflow are common starting points. Water by soaking or thoroughly wetting according to species, then let the entire plant dry promptly.",
      learn:"The key risk is water trapped around the leaf bases. Never assume a soil-free plant can survive without regular watering."
    },
    aroid: {
      about:"Aroids are plants of the Araceae family; many popular houseplants are climbers or forest-floor herbs. Botanically, the family is known for a spadix (tiny flowers on a spike) often surrounded by a spathe.",
      recognize:"Look for nodes, climbing stems, aerial roots, and juvenile-to-adult leaf changes in vining species. Not every aroid climbs.",
      conditions:"Many tropical foliage aroids favor bright indirect light and an aerated medium. Watering depends on the roots: a Monstera is not managed exactly like a ZZ plant or peace lily.",
      learn:"New holes in Monstera leaves are called fenestrations; they develop as leaves mature, not because the plant is being eaten."
    },
    bromeliad: {
      about:"Bromeliads are members of Bromeliaceae, often tropical plants that form a rosette of overlapping leaves. Some live on branches as epiphytes and others grow in the ground.",
      recognize:"Colorful structures are often bracts, not petals. Many rosette species flower once per rosette and produce pups.",
      conditions:"Many ornamental tank bromeliads enjoy bright filtered light, airy roots, and water management appropriate to the leaf cup. Air plants are bromeliads too, but need a different routine.",
      learn:"A fading flower display does not automatically mean the whole plant is lost—check for offsets from the base."
    },
    cactus: {
      about:"Cacti are members of Cactaceae. Most use succulent stems to store water; specialized structures called areoles distinguish true cacti from other spiny succulents.",
      recognize:"Areoles produce spines, hairs, flowers, or branches. In Mammillaria, stems are covered in small tubercles.",
      conditions:"A bright position, free-draining mineral-rich mix, drainage holes, and substantial drying between waterings suit many desert cacti.",
      learn:"Not every cactus is a desert plant—forest/epiphytic cacti can need much different light and moisture."
    },
    carnivorous: {
      about:"Carnivorous plants capture and digest small animals to obtain nutrients in habitats where the soil is often nutrient-poor. Different families evolved different traps.",
      recognize:"Venus flytraps use hinged snap traps; sundews use sticky glands, and pitcher plants use fluid-filled leaves.",
      conditions:"Your Venus flytrap needs very strong light, low-mineral water (rain/distilled/RO), nutrient-poor suitable media, and seasonal winter dormancy.",
      learn:"Carnivorous does not mean 'feed fertilizer' or 'keep in a terrarium': nutrients and dormancy vary widely among species."
    },
    croton: {
      about:"Ornamental crotons are brightly colored cultivars of Codiaeum variegatum, a tropical shrub in Euphorbiaceae.",
      recognize:"Variegated, often leathery leaves may show red, orange, yellow, green, and near-purple shades in many shapes.",
      conditions:"Bright light supports color. Warm, stable conditions and an airy mix that is not kept sodden are useful starting points.",
      learn:"Sudden cold, moves, or watering swings may trigger leaf drop; crotons have irritating milky sap."
    },
    dracaena: {
      about:"Dracaenas are tropical woody or cane-forming monocots in Asparagaceae. They include dragon trees and so-called lucky bamboo.",
      recognize:"Leaves often form rosettes along canes or at stem tips; some plants produce roots from cut stem sections.",
      conditions:"Many tolerate bright indirect light and moderate drying. Water-grown lucky bamboo is a special case and is maintained differently from potted dragon trees.",
      learn:"Lucky bamboo is not a grass or a true bamboo. Dracaenas may be sensitive to mineral-heavy water."
    },
    fern: {
      about:"Ferns are an ancient group of vascular plants that reproduce by spores rather than flowers or seeds.",
      recognize:"Look for unfurling fiddleheads in many species and spore-bearing structures (sori) on mature fronds.",
      conditions:"Many indoor ferns prefer filtered light, humidity, and an evenly managed, aerated root zone; the blue star fern can dry slightly at the surface.",
      learn:"Brown frond tips can reflect dry air, inconsistent moisture, or salts; spores under a leaf are not necessarily pests."
    },
    flowering: {
      about:"This is a display category, not a botanical family: almost all plants in GAIA's collection except its fern are flowering plants botanically.",
      recognize:"These specimens are grouped for their blossoms, colorful bracts, or ornamental bedding habit—not shared ancestry.",
      conditions:"Light and moisture differ enormously: dusty miller favors sun and drainage; peace lily generally favors filtered light and more moisture.",
      learn:"A 'flower' on a peace lily is actually a spathe around a spike of tiny flowers. Check species-level care rather than applying one rule."
    },
    orchid: {
      about:"Orchids are Orchidaceae plants with specialized flowers; many common moth orchids are epiphytes that grow attached to trees.",
      recognize:"Moth orchids have thick, spreading roots covered in velamen, broad leaves, and elongated flower spikes.",
      conditions:"Phalaenopsis generally prefers bright filtered light, plentiful air around its roots, and a drying cycle suited to bark and pot size.",
      learn:"Silver-looking orchid roots can be normal when dry. Avoid permanently waterlogged bark and water sitting in the central crown."
    },
    palm: {
      about:"True palms belong to Arecaceae, a distinct family of flowering monocots. The 'palm' look occurs in unrelated plants too.",
      recognize:"Palms typically have feather-like or fan-like fronds and a central growing point; your parlor palm is a shade-adapted understory palm.",
      conditions:"For a parlor palm, filtered light and moderate, well-drained moisture are typical. Broad rules for sun-loving outdoor palms do not necessarily apply.",
      learn:"Ponytail palm is not a true palm. Damaging a single palm's growing crown can be serious because many palms have one main growth point."
    },
    pilea: {
      about:"Pilea is a genus in the nettle family, Urticaceae. Many species are compact, textured-leaf houseplants.",
      recognize:"Look for opposite leaves in some species, silver patches, puckered textures, or spreading stems depending on the species.",
      conditions:"Most ornamental pileas do well in bright indirect light and an aerated medium that does not stay wet; some dislike drying completely.",
      learn:"Aluminum plant and friendship plant share a genus but can have different leaf shapes and moisture preferences."
    },
    prayer: {
      about:"'Prayer plant' is a broad horticultural term for Marantaceae relatives such as Maranta and Goeppertia (often sold as Calathea).",
      recognize:"Many adjust leaf positions between day and night, a movement called nyctinasty.",
      conditions:"Usually bright to medium indirect light, steady warmth, and even but airy moisture. Dry air and salty water can damage leaf edges.",
      learn:"Rolling or edge browning can be a stress signal; leaf movement by itself is generally normal."
    },
    succulent: {
      about:"'Succulent' is a water-storage adaptation, not one branch of the plant family tree. Aloe, haworthia, houseleek, and ponytail palm are not all close relatives.",
      recognize:"Look for thick leaves, water-storing stems or swollen trunks. The exact storage organ varies.",
      conditions:"Many prefer bright light, drainage, and time to dry out between waterings, but their light, dormancy, and moisture tolerance differ by species.",
      learn:"Do not water every succulent on the same date. Your indoor aloe and a cold-tolerant Sempervivum need different conditions."
    },
    tradescantia: {
      about:"Tradescantias are fast-growing, often trailing members of Commelinaceae, grown for patterned or purple foliage.",
      recognize:"Soft segmented stems with obvious nodes root easily, and many have a stripe or colored underside.",
      conditions:"Bright indirect light or some gentle direct sun often promotes compact, colorful growth. Let a draining mix dry somewhat; avoid prolonged wet roots.",
      learn:"Regular pinching can encourage branching. Long bare stems can be restarted using healthy node cuttings."
    },
    tropical: {
      about:"Tropical foliage is a growing-style category containing unrelated families. Plants are grouped for warm-climate foliage rather than common ancestry.",
      recognize:"Growth can be upright, shrubby, clumping, or trailing. Examples include your money tree, nerve plant, false aralia, and spider plant.",
      conditions:"Many enjoy warmth, stable light, and good drainage, but water and humidity needs range from quite moist to distinctly dry.",
      learn:"Don't apply the same schedule to GLaDOS (Fittonia) and Cole (spider plant); the family and species details are better predictors."
    },
    vine: {
      about:"A vine is a growth habit: stems elongate and climb, scramble, or trail using structures such as tendrils, twining stems, or aerial roots.",
      recognize:"Look for elongated stems and climbing or trailing growth; your grape ivy uses tendrils.",
      conditions:"Most indoor vines need enough light to avoid stretched internodes and some form of support or room to trail. Watering depends on the species.",
      learn:"Grape ivy is part of Vitaceae (the grape family), not Araliaceae or the true ivy genus Hedera."
    },
    zz: {
      about:"The ZZ plant is Zamioculcas zamiifolia, an aroid unusual for its thick, water-storing underground rhizomes.",
      recognize:"Glossy pinnate leaves rise from rhizomes; Raven cultivars darken dramatically as new foliage matures.",
      conditions:"Often tolerates medium or lower indoor light, but grows best with brighter filtered light. Let the root zone dry substantially before another watering.",
      learn:"Although ZZ is in Araceae, its water storage makes it much more drought-tolerant than a peace lily."
    }
  };

  const families = {
    Acanthaceae: {
      about:"The acanthus family includes many herbs and shrubs, often with opposite leaves and striking tubular flowers; Fittonia is valued mainly for its veins.",
      recognize:"Fine contrasting leaf veins are especially prominent on the nerve plants in your collection.",
      conditions:"For Fittonia, favor filtered light, warmth, and an airy medium kept more evenly moist than succulent soil.",
      learn:"A family can contain many different growth habits; this guideline describes the Fittonia in GAIA, not every acanthus-family plant."
    },
    Amaranthaceae: {
      about:"The amaranth family contains numerous herbs and shrubs, including Alternanthera, which is often grown for pigmented foliage.",
      recognize:"Many ornamental joyweeds develop red, burgundy, pink, or yellow-green leaves in strong light.",
      conditions:"Your Alternanthera generally needs a bright location and fairly regular moisture in well-drained soil.",
      learn:"Foliage color is influenced by cultivar and light; this diverse family does not share a single indoor-care recipe."
    },
    Araceae: {
      about:"The arum family is united botanically by tiny flowers on a spadix, usually accompanied by a spathe. It includes climbing vines, clumping herbs, and rhizomatous plants.",
      recognize:"Look for nodes, aerial roots, specialized leaf forms, and spathe/spadix blooms. These features differ across genera.",
      conditions:"Many forest aroids enjoy filtered light and oxygen around their roots. Do not generalize a wetness level: ZZ, Monstera, Anthurium, and Spathiphyllum differ.",
      learn:"The showy white 'flower' on a peace lily is a spathe; ZZ plants are aroids even though they look more like drought-tolerant foliage plants."
    },
    Araliaceae: {
      about:"The ginseng/ivy family includes trees, shrubs, vines, and herbs; leaves are often compound or lobed. Your false aralia is a woody example.",
      recognize:"False aralia has unusually narrow, finely divided juvenile leaflets that differ from mature foliage.",
      conditions:"Your Plerandra prefers filtered bright light, warm stable air, and a medium that drains but does not stay bone-dry.",
      learn:"Common names ending in 'aralia' do not always indicate the same genus or the same care needs."
    },
    Arecaceae: {
      about:"The palm family consists of true palms, woody flowering monocots with fronds arising from growing points, unlike ponytail palms.",
      recognize:"Many have feather-like or fan-shaped leaves; parlor palm develops delicate pinnate fronds.",
      conditions:"For your understory Chamaedorea, choose filtered light and a pot that drains without extended saturation.",
      learn:"Arecaceae identifies evolutionary relatives; 'palm' in an everyday name is not proof of membership."
    },
    Asparagaceae: {
      about:"The asparagus family is unusually varied, including Dracaena, Chlorophytum, and Beaucarnea in its modern broad classification.",
      recognize:"Members can have strap-like leaves, canes, fleshy roots, or water-storing swollen stems. There is no single family-wide silhouette.",
      conditions:"Care is highly variable: Groot stores water in a swollen base, Drogo grows as a woody dracaena, and Cole has arching foliage and fleshy roots.",
      learn:"This is GAIA's best reminder that being in the same family does NOT mean two plants should be watered together."
    },
    Asphodelaceae: {
      about:"This family includes Aloe and Haworthiopsis, familiar southern African succulent groups with compact leaf rosettes.",
      recognize:"Fleshy leaves and often basal offsets are common among the genera represented here.",
      conditions:"A draining gritty medium and dry-down periods are useful for your plants, but aloe usually enjoys stronger light than a zebra-type Haworthiopsis.",
      learn:"Related succulents can differ significantly in sun tolerance; check leaf stress and the species profile."
    },
    Asteraceae: {
      about:"The daisy family is identified primarily by composite flower heads—many tiny florets packed into what looks like one flower.",
      recognize:"Your dusty miller, ruby necklace, and Curio succulent share this family despite looking quite different.",
      conditions:"There is no standard watering routine: dusty miller wants sun and drainage, while ruby necklace and Curio store water in fleshy growth.",
      learn:"Asteraceae's composite flower head is a botanical clue that may not be obvious on indoor plants that rarely bloom."
    },
    Bromeliaceae: {
      about:"The bromeliad family includes rosette-forming plants and epiphytes, such as Guzmania and Tillandsia.",
      recognize:"Leaves often carry specialized scales; colorful bracts and offsets are common in many ornamental members.",
      conditions:"Guzmania can hold water in a leaf cup and needs an airy substrate; Tillandsia generally grows without soil and needs ventilation after wetting.",
      learn:"Both are bromeliads, but one is a tank-forming potted rosette and the other an air plant."
    },
    Cactaceae: {
      about:"The cactus family is distinguished by areoles: small pads that produce spines, flowers, or new growth.",
      recognize:"Mammillaria often shows spiral patterns of tubercles tipped with areoles.",
      conditions:"For your probable Mammillaria, aim for bright light and a gritty freely draining mix, with thorough drying between waterings.",
      learn:"A thorny succulent without areoles may not be a cactus at all."
    },
    Commelinaceae: {
      about:"The spiderwort family includes Tradescantia and relatives, typically soft-stemmed monocots with distinct nodes.",
      recognize:"Trailing, jointed stems and leaf sheaths are common among the forms you own.",
      conditions:"Your Tradescantias generally like bright light, a draining potting mix, and watering based on soil dryness.",
      learn:"Stem pieces root readily at nodes, making this one of the easier groups to propagate."
    },
    Crassulaceae: {
      about:"The stonecrop family includes many leaf-succulent rosettes and mats, including Sempervivum ('hens and chicks').",
      recognize:"Compact fleshy rosettes and readily produced offsets are common among houseleeks.",
      conditions:"Sempervivum needs stronger outdoor-style light, gritty drainage, and winter conditions different from many tropical indoor succulents.",
      learn:"A flowering Sempervivum rosette dies after setting seed, but offsets can keep the colony going."
    },
    Droseraceae: {
      about:"The sundew family contains carnivorous plants such as Drosera and Dionaea; prey capture helps them obtain nutrients in nutrient-poor habitats.",
      recognize:"The Venus flytrap's hinged trap consists of specialized leaf lobes with sensory trigger hairs.",
      conditions:"Dionaea needs very strong light, mineral-poor water and media, and a cool winter dormancy period.",
      learn:"'Carnivorous' is about nutrition, not a license to fertilize potting soil or repeatedly trigger traps."
    },
    Euphorbiaceae: {
      about:"The spurge family is diverse and includes Codiaeum, the ornamental croton genus, alongside many plants that look nothing like crotons.",
      recognize:"Your crotons are recognized by dramatic colored leaves; many members of Euphorbiaceae have milky, irritating sap.",
      conditions:"Crotons generally prefer bright light, warmth, and evenly managed moisture in a well-drained pot.",
      learn:"Their colorful leaves are not flowers. Wear care when pruning because sap may irritate skin."
    },
    Geraniaceae: {
      about:"The geranium family includes Pelargonium, the scented-leaf plants commonly sold as 'geraniums.'",
      recognize:"Leaves can contain aromatic glands that release scent when brushed.",
      conditions:"Scented Pelargonium usually grows best in bright light with good airflow and a medium allowed to dry somewhat.",
      learn:"Pelargonium and the true genus Geranium are relatives but are not the same genus. 'Citronella plant' does not guarantee mosquito control."
    },
    Lamiaceae: {
      about:"The mint family includes many aromatic herbs and ornamentals, including Plectranthus, commonly called spurflower.",
      recognize:"Square-ish stems, opposite leaves, and two-lipped flowers are frequent, but not universal, family clues.",
      conditions:"For your Plectranthus plants, filtered bright light, an airy medium, and modest dry-down generally work well.",
      learn:"Stem-tip pruning can promote branching; plants in a mint family need not smell or taste like mint."
    },
    Malvaceae: {
      about:"The mallow family includes herbs, shrubs, and trees; Pachira (money tree) is a tropical tree in this family.",
      recognize:"Money trees have palmate compound leaves—leaflets arranged like fingers from one point.",
      conditions:"For Tywin, prioritize stable warmth, bright filtered light, drainage, and watering after part of the root zone dries.",
      learn:"The braided trunk on commercial money trees is made by growers, not a natural species characteristic."
    },
    Marantaceae: {
      about:"The prayer-plant family includes Maranta and Goeppertia/Calathea relatives, often tropical understory herbs growing from rhizomes.",
      recognize:"Patterned leaves may rise and lower due to changes in the leaf joint (pulvinus).",
      conditions:"Most indoor types prefer filtered light, moderate humidity, and evenly managed moisture without stagnant roots.",
      learn:"Daily leaf movement is nyctinasty; crispy edges are more often a water, humidity, or mineral problem."
    },
    Orchidaceae: {
      about:"The orchid family is one of the largest flowering-plant families, with unusually specialized and varied flowers.",
      recognize:"Your Phalaenopsis has thick velamen-covered roots and a strap-leaf crown; many tropical orchids live as epiphytes.",
      conditions:"For moth orchids, use filtered light, airy bark or similar suitable media, and watering guided by root and substrate condition.",
      learn:"Aerial roots are normal; packing them into waterlogged soil can cause rot."
    },
    Polypodiaceae: {
      about:"A large fern family that includes many epiphytic ferns. Phlebodium has creeping rhizomes and lobed fronds.",
      recognize:"Your blue star fern has blue-green fronds arising from fuzzy surface rhizomes.",
      conditions:"Filtered light, airy moisture-retentive media, and avoiding drought or long-term waterlogging are good starting points for Phlebodium.",
      learn:"The fuzzy rhizome is a living plant structure; don't bury or scrub it as though it were a pest."
    },
    Strelitziaceae: {
      about:"The bird-of-paradise family consists of large, usually clumping tropical plants with robust leaves and distinctive flowers.",
      recognize:"Strelitzia produces long-petioled, paddle-shaped leaves; flowering depends on species and maturity.",
      conditions:"A very bright site with room to grow and a draining, moderately moisture-retentive mix suits many cultivated Strelitzia.",
      learn:"Indoor plants may take years to flower; splitting or tearing along mature leaves can be a natural response to wind and handling."
    },
    Urticaceae: {
      about:"The nettle family includes stinging nettles and nonstinging ornamental Pilea species.",
      recognize:"Your Pilea have ornamental textures, such as silver patches or quilted surfaces, rather than the famous nettle hairs.",
      conditions:"Many decorative pileas appreciate indirect light and steady but airy moisture. Check the particular species before choosing a dry-down threshold.",
      learn:"Family membership does not mean your aluminum plant or friendship plant should sting you."
    },
    Vitaceae: {
      about:"The grape family includes woody or herbaceous climbers that often rely on tendrils; Cissus is a tropical example.",
      recognize:"Your grape ivy has trailing or climbing shoots with tendrils and lobed leaflets.",
      conditions:"Filtered light, a draining mix, and watering after the surface dries typically suit indoor Cissus.",
      learn:"Grape ivy is related to grapes, not to the ivy genus Hedera."
    }
  };
  // Titles and taxonomy are separate from the live plant-specific care records.
  const resources = {
    care: "https://www.rhs.org.uk/plants/types/houseplants/growing-guide",
    familySearch: "https://powo.science.kew.org/results?q="
  };
  window.GAIA_GROUP_LEARNING = Object.freeze({types, families, resources});
})();

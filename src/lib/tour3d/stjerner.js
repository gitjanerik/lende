// GENERERT AV scripts/bygg-stjerner.mjs — IKKE REDIGER FOR HÅND.
//
// Stjernekatalog for 3D-natthimmelen. Kilde: HYG-databasen (Hipparcos + Yale
// BSC + Gliese), epoke J2000. 147 stjerner: alle lysere enn
// magnitude 2.6, pluss dem stjernebildene under trenger.
//
//   ra   rektascensjon i TIMER (0–24)
//   dek  deklinasjon i grader (−90–90)
//   mag  visuell magnitude — lavere er lysere
//
// Kjør skriptet på nytt for å endre utvalget eller legge til et stjernebilde;
// LINJER peker med indekser inn i STJERNER, så de to må bakes sammen.
/* eslint-disable */

export const STJERNER = [
  { ra: 0.13979, dek: 29.09043, mag: 2.07, navn: "Alpheratz" },   // Alp And
  { ra: 0.15289, dek: 59.14978, mag: 2.28, navn: "Caph" },   // Bet Cas
  { ra: 0.43806, dek: -42.30598, mag: 2.4, navn: "Ankaa" },   // Alp Phe
  { ra: 0.67512, dek: 56.53733, mag: 2.24, navn: "Schedar" },   // Alp Cas
  { ra: 0.72649, dek: -17.98661, mag: 2.04, navn: "Diphda" },   // Bet Cet
  { ra: 0.94514, dek: 60.71674, mag: 2.15, navn: "Cih" },   // Gam Cas
  { ra: 1.16219, dek: 35.62056, mag: 2.07, navn: "Mirach" },   // Bet And
  { ra: 1.43022, dek: 60.23528, mag: 2.66, navn: "Ruchbah" },   // Del Cas
  { ra: 1.62856, dek: -57.23676, mag: 0.45, navn: "Achernar" },   // Alp Eri
  { ra: 1.90658, dek: 63.6701, mag: 3.35, navn: "Segin" },   // Eps Cas
  { ra: 2.06498, dek: 42.32973, mag: 2.1, navn: "Almach" },   // Gam-1 And
  { ra: 2.11956, dek: 23.46242, mag: 2.01, navn: "Hamal" },   // Alp Ari
  { ra: 2.52975, dek: 89.26411, mag: 1.97, navn: "Polaris" },   // Alp UMi
  { ra: 2.84495, dek: 55.8955, mag: 3.77, navn: "Miram" },   // Eta Per
  { ra: 3.03799, dek: 4.08973, mag: 2.54, navn: "Menkar" },   // Alp Cet
  { ra: 3.07994, dek: 53.50644, mag: 2.91, navn: null },   // Gam Per
  { ra: 3.13615, dek: 40.95565, mag: 2.09, navn: "Algol" },   // Bet Per
  { ra: 3.40538, dek: 49.86118, mag: 1.79, navn: "Mirfak" },   // Alp Per
  { ra: 3.71542, dek: 47.78755, mag: 3.01, navn: null },   // Del Per
  { ra: 3.96423, dek: 40.01022, mag: 2.9, navn: null },   // Eps Per
  { ra: 4.59868, dek: 16.5093, mag: 0.87, navn: "Aldebaran" },   // Alp Tau
  { ra: 4.94989, dek: 33.16609, mag: 2.69, navn: "Hassaleh" },   // Iot Aur
  { ra: 5.2423, dek: -8.20164, mag: 0.18, navn: "Rigel" },   // Bet Ori
  { ra: 5.27815, dek: 45.99799, mag: 0.08, navn: "Capella" },   // Alp Aur
  { ra: 5.41885, dek: 6.3497, mag: 1.64, navn: "Bellatrix" },   // Gam Ori
  { ra: 5.4382, dek: 28.60745, mag: 1.65, navn: "Elnath" },   // Bet Tau
  { ra: 5.53345, dek: -0.29909, mag: 2.25, navn: "Mintaka" },   // Del Ori
  { ra: 5.5455, dek: -17.82229, mag: 2.58, navn: "Arneb" },   // Alp Lep
  { ra: 5.60356, dek: -1.20192, mag: 1.69, navn: "Alnilam" },   // Eps Ori
  { ra: 5.67931, dek: -1.94257, mag: 1.74, navn: "Alnitak" },   // Zet Ori
  { ra: 5.79594, dek: -9.66961, mag: 2.07, navn: "Saiph" },   // Kap Ori
  { ra: 5.91953, dek: 7.40706, mag: 0.45, navn: "Betelgeuse" },   // Alp Ori
  { ra: 5.99215, dek: 44.94743, mag: 1.9, navn: "Menkalinan" },   // Bet Aur
  { ra: 5.99535, dek: 37.21258, mag: 2.65, navn: "Mahasim" },   // The Aur
  { ra: 6.24796, dek: 22.5068, mag: 3.31, navn: "Propus" },   // Eta Gem
  { ra: 6.37833, dek: -17.95592, mag: 1.98, navn: "Mirzam" },   // Bet CMa
  { ra: 6.39919, dek: -52.69566, mag: -0.62, navn: "Canopus" },   // Alp Car
  { ra: 6.62853, dek: 16.39925, mag: 1.93, navn: "Alhena" },   // Gam Gem
  { ra: 6.7322, dek: 25.13112, mag: 3.06, navn: "Mebsuta" },   // Eps Gem
  { ra: 6.75248, dek: -16.71612, mag: -1.44, navn: "Sirius" },   // Alp CMa
  { ra: 6.9771, dek: -28.97208, mag: 1.5, navn: "Adhara" },   // Eps CMa
  { ra: 7.13986, dek: -26.3932, mag: 1.83, navn: "Wezen" },   // Del CMa
  { ra: 7.33538, dek: 21.98232, mag: 3.5, navn: "Wasat" },   // Del Gem
  { ra: 7.40158, dek: -29.3031, mag: 2.45, navn: "Aludra" },   // Eta CMa
  { ra: 7.57663, dek: 31.88828, mag: 1.58, navn: "Castor" },   // Alp Gem
  { ra: 7.65503, dek: 5.22499, mag: 0.4, navn: "Procyon" },   // Alp CMi
  { ra: 7.75528, dek: 28.0262, mag: 1.16, navn: "Pollux" },   // Bet Gem
  { ra: 8.05974, dek: -40.00315, mag: 2.21, navn: "Naos" },   // Zet Pup
  { ra: 8.15888, dek: -47.33659, mag: 1.75, navn: null },   // Gam-2 Vel
  { ra: 8.37524, dek: -59.50948, mag: 1.86, navn: "Avior" },   // Eps Car
  { ra: 8.74506, dek: -54.70882, mag: 1.93, navn: "Alsephina" },   // Del Vel
  { ra: 9.13327, dek: -43.43259, mag: 2.23, navn: "Suhail" },   // Lam Vel
  { ra: 9.22004, dek: -69.71721, mag: 1.67, navn: "Miaplacidus" },   // Bet Car
  { ra: 9.28484, dek: -59.27523, mag: 2.21, navn: "Aspidiske" },   // Iot Car
  { ra: 9.36856, dek: -55.01067, mag: 2.47, navn: "Markeb" },   // Kap Vel
  { ra: 9.45979, dek: -8.6586, mag: 1.99, navn: "Alphard" },   // Alp Hya
  { ra: 9.76419, dek: 23.77426, mag: 2.97, navn: "Ras Elased Australis" },   // Eps Leo
  { ra: 9.8794, dek: 26.00695, mag: 3.88, navn: "Rasalas" },   // Mu Leo
  { ra: 10.12221, dek: 16.76266, mag: 3.48, navn: null },   // Eta Leo
  { ra: 10.13953, dek: 11.96721, mag: 1.36, navn: "Regulus" },   // Alp Leo
  { ra: 10.27817, dek: 23.41731, mag: 3.43, navn: "Adhafera" },   // Zet Leo
  { ra: 10.33287, dek: 19.84149, mag: 2.01, navn: "Algieba" },   // Gam-1 Leo
  { ra: 11.03068, dek: 56.38243, mag: 2.34, navn: "Merak" },   // Bet UMa
  { ra: 11.06216, dek: 61.75103, mag: 1.81, navn: "Dubhe" },   // Alp UMa
  { ra: 11.23514, dek: 20.52372, mag: 2.56, navn: "Zosma" },   // Del Leo
  { ra: 11.23733, dek: 15.42957, mag: 3.33, navn: "Chertan" },   // The Leo
  { ra: 11.52341, dek: 69.33108, mag: 3.82, navn: "Giausar" },   // Lam Dra
  { ra: 11.81766, dek: 14.57206, mag: 2.14, navn: "Denebola" },   // Bet Leo
  { ra: 11.89717, dek: 53.69476, mag: 2.41, navn: "Phecda" },   // Gam UMa
  { ra: 12.13931, dek: -50.72243, mag: 2.58, navn: null },   // Del Cen
  { ra: 12.25709, dek: 57.03262, mag: 3.32, navn: "Megrez" },   // Del UMa
  { ra: 12.26344, dek: -17.54193, mag: 2.58, navn: "Gienah" },   // Gam Crv
  { ra: 12.44331, dek: -63.09909, mag: 0.77, navn: "Acrux" },   // Alp-1 Cru
  { ra: 12.51943, dek: -57.11321, mag: 1.59, navn: "Gacrux" },   // Gam Cru
  { ra: 12.55806, dek: 69.78824, mag: 3.85, navn: null },   // Kap Dra
  { ra: 12.69197, dek: -48.95989, mag: 2.2, navn: null },   // Gam Cen
  { ra: 12.79536, dek: -59.68876, mag: 1.25, navn: "Mimosa" },   // Bet Cru
  { ra: 12.90047, dek: 55.95982, mag: 1.76, navn: "Alioth" },   // Eps UMa
  { ra: 13.39875, dek: 54.92536, mag: 2.23, navn: "Mizar" },   // Zet UMa
  { ra: 13.41988, dek: -11.16132, mag: 0.98, navn: "Spica" },   // Alp Vir
  { ra: 13.6648, dek: -53.46639, mag: 2.29, navn: null },   // Eps Cen
  { ra: 13.79235, dek: 49.31327, mag: 1.85, navn: "Alkaid" },   // Eta UMa
  { ra: 13.92567, dek: -47.28838, mag: 2.55, navn: null },   // Zet Cen
  { ra: 14.06373, dek: -60.37304, mag: 0.61, navn: "Hadar" },   // Bet Cen
  { ra: 14.07316, dek: 64.37585, mag: 3.67, navn: "Thuban" },   // Alp Dra
  { ra: 14.11139, dek: -36.36995, mag: 2.06, navn: "Menkent" },   // The Cen
  { ra: 14.26103, dek: 19.18241, mag: -0.05, navn: "Arcturus" },   // Alp Boo
  { ra: 14.5305, dek: 30.37144, mag: 3.57, navn: null },   // Rho Boo
  { ra: 14.53464, dek: 38.30825, mag: 3.04, navn: "Seginus" },   // Gam Boo
  { ra: 14.59179, dek: -42.15782, mag: 2.33, navn: null },   // Eta Cen
  { ra: 14.66076, dek: -60.83398, mag: -0.01, navn: "Rigil Kentaurus" },   // Alp-1 Cen
  { ra: 14.69882, dek: -47.3882, mag: 2.3, navn: null },   // Alp Lup
  { ra: 14.74978, dek: 27.07422, mag: 2.35, navn: "Izar" },   // Eps Boo
  { ra: 14.84511, dek: 74.15551, mag: 2.07, navn: "Kochab" },   // Bet UMi
  { ra: 15.03244, dek: 40.39057, mag: 3.49, navn: "Nekkar" },   // Bet Boo
  { ra: 15.25838, dek: 33.31483, mag: 3.46, navn: null },   // Del Boo
  { ra: 15.34548, dek: 71.83402, mag: 3, navn: "Pherkad" },   // Gam UMi
  { ra: 15.41549, dek: 58.96607, mag: 3.29, navn: "Edasich" },   // Iot Dra
  { ra: 15.57813, dek: 26.71469, mag: 2.22, navn: "Alphecca" },   // Alp CrB
  { ra: 15.7343, dek: 77.79449, mag: 4.29, navn: null },   // Zet UMi
  { ra: 16.00556, dek: -22.62171, mag: 2.29, navn: "Dschubba" },   // Del Sco
  { ra: 16.09062, dek: -19.80545, mag: 2.56, navn: "Acrab" },   // Bet-1 Sco
  { ra: 16.29179, dek: 75.75533, mag: 4.95, navn: null },   // Eta UMi
  { ra: 16.39986, dek: 61.51421, mag: 2.73, navn: "Athebyne" },   // Eta Dra
  { ra: 16.49013, dek: -26.432, mag: 1.06, navn: "Antares" },   // Alp Sco
  { ra: 16.61932, dek: -10.56709, mag: 2.54, navn: null },   // Zet Oph
  { ra: 16.76616, dek: 82.03726, mag: 4.21, navn: null },   // Eps UMi
  { ra: 16.81108, dek: -69.02772, mag: 1.91, navn: "Atria" },   // Alp TrA
  { ra: 16.83608, dek: -34.29323, mag: 2.29, navn: "Larawag" },   // Eps Sco
  { ra: 17.14645, dek: 65.71468, mag: 3.17, navn: "Aldhibah" },   // Zet Dra
  { ra: 17.17297, dek: -15.72491, mag: 2.43, navn: "Sabik" },   // Eta Oph
  { ra: 17.50721, dek: 52.30139, mag: 2.79, navn: "Rastaban" },   // Bet Dra
  { ra: 17.53692, dek: 86.58646, mag: 4.35, navn: "Yildun" },   // Del UMi
  { ra: 17.56014, dek: -37.10382, mag: 1.62, navn: "Shaula" },   // Lam Sco
  { ra: 17.58224, dek: 12.56003, mag: 2.08, navn: "Rasalhague" },   // Alp Oph
  { ra: 17.62198, dek: -42.99782, mag: 1.86, navn: "Sargas" },   // The Sco
  { ra: 17.70813, dek: -39.02998, mag: 2.39, navn: null },   // Kap Sco
  { ra: 17.89213, dek: 56.87264, mag: 3.73, navn: "Grumium" },   // Xi Dra
  { ra: 17.94344, dek: 51.48889, mag: 2.24, navn: "Eltanin" },   // Gam Dra
  { ra: 18.40287, dek: -34.38462, mag: 1.79, navn: "Kaus Australis" },   // Eps Sgr
  { ra: 18.61564, dek: 38.78369, mag: 0.03, navn: "Vega" },   // Alp Lyr
  { ra: 18.74621, dek: 37.60511, mag: 4.34, navn: null },   // Zet-1 Lyr
  { ra: 18.83467, dek: 33.36267, mag: 3.52, navn: "Sheliak" },   // Bet Lyr
  { ra: 18.90841, dek: 36.89861, mag: 4.22, navn: null },   // Del-2 Lyr
  { ra: 18.92109, dek: -26.29672, mag: 2.05, navn: "Nunki" },   // Sig Sgr
  { ra: 18.9824, dek: 32.68956, mag: 3.25, navn: "Sulafat" },   // Gam Lyr
  { ra: 19.04353, dek: -29.88011, mag: 2.6, navn: "Ascella" },   // Zet Sgr
  { ra: 19.20922, dek: 67.66154, mag: 3.07, navn: "Altais" },   // Del Dra
  { ra: 19.51202, dek: 27.95968, mag: 3.05, navn: "Albireo" },   // Bet-1 Cyg
  { ra: 19.74957, dek: 45.13081, mag: 2.86, navn: "Fawaris" },   // Del Cyg
  { ra: 19.84639, dek: 8.86832, mag: 0.76, navn: "Altair" },   // Alp Aql
  { ra: 19.93844, dek: 35.08342, mag: 3.89, navn: null },   // Eta Cyg
  { ra: 20.37047, dek: 40.25668, mag: 2.23, navn: "Sadr" },   // Gam Cyg
  { ra: 20.42746, dek: -56.73509, mag: 1.94, navn: "Peacock" },   // Alp Pav
  { ra: 20.69053, dek: 45.28034, mag: 1.25, navn: "Deneb" },   // Alp Cyg
  { ra: 20.77018, dek: 33.97026, mag: 2.48, navn: "Aljanah" },   // Eps Cyg
  { ra: 21.30963, dek: 62.58557, mag: 2.45, navn: "Alderamin" },   // Alp Cep
  { ra: 21.47766, dek: 70.56072, mag: 3.23, navn: "Alfirk" },   // Bet Cep
  { ra: 21.73643, dek: 9.87501, mag: 2.38, navn: "Enif" },   // Eps Peg
  { ra: 22.13721, dek: -46.96097, mag: 1.73, navn: "Alnair" },   // Alp Gru
  { ra: 22.18091, dek: 58.20126, mag: 3.39, navn: null },   // Zet Cep
  { ra: 22.71111, dek: -46.88458, mag: 2.07, navn: "Tiaki" },   // Bet Gru
  { ra: 22.82802, dek: 66.20041, mag: 3.5, navn: null },   // Iot Cep
  { ra: 22.96084, dek: -29.62224, mag: 1.17, navn: "Fomalhaut" },   // Alp PsA
  { ra: 23.0629, dek: 28.08279, mag: 2.44, navn: "Scheat" },   // Bet Peg
  { ra: 23.07935, dek: 15.20526, mag: 2.49, navn: "Markab" },   // Alp Peg
  { ra: 23.65582, dek: 77.63228, mag: 3.21, navn: "Errai" },   // Gam Cep
]

/** Stjernebilde-linjer som indekspar inn i STJERNER. */
export const LINJER = [
  [63, 62],
  [62, 68],
  [68, 70],
  [70, 77],
  [77, 78],
  [78, 81],
  [12, 112],
  [112, 106],
  [106, 99],
  [99, 93],
  [93, 96],
  [96, 102],
  [102, 99],
  [9, 7],
  [7, 5],
  [5, 3],
  [3, 1],
  [31, 24],
  [31, 29],
  [24, 26],
  [26, 28],
  [28, 29],
  [29, 30],
  [26, 22],
  [134, 132],
  [132, 131],
  [131, 128],
  [129, 132],
  [132, 135],
  [120, 121],
  [121, 123],
  [123, 125],
  [125, 122],
  [122, 121],
  [118, 117],
  [117, 111],
  [111, 118],
  [117, 127],
  [127, 109],
  [109, 103],
  [103, 97],
  [97, 84],
  [84, 74],
  [74, 66],
  [13, 15],
  [15, 17],
  [17, 18],
  [18, 19],
  [18, 16],
  [86, 92],
  [92, 95],
  [95, 94],
  [94, 88],
  [88, 87],
  [87, 86],
  [136, 137],
  [137, 146],
  [146, 142],
  [142, 140],
  [140, 136],
  [23, 32],
  [32, 33],
  [33, 25],
  [25, 21],
  [21, 23],
  [44, 46],
  [46, 42],
  [42, 37],
  [44, 38],
  [38, 34],
  [56, 57],
  [57, 60],
  [60, 61],
  [61, 58],
  [58, 59],
  [61, 64],
  [64, 67],
  [64, 65],
  [65, 59],
]

/** Navnene på stjernebildene linjene tegner — for kommentar og test. */
export const STJERNEBILDER = ["Karlsvogna","Lille bjørn","Cassiopeia","Orion","Svanen","Lyren","Dragen","Perseus","Bjørnevokteren","Cepheus","Kjøresvennen","Tvillingene","Løven"]

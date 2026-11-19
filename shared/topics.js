// Real resolutions from National Speech & Debate Association (NSDA) competition.
// LD = Lincoln-Douglas (wording from the NSDA topics page),
// PF = Public Forum. `season` is when the resolution was debated.

export const CATEGORIES = [
  {
    id: 'world',
    name: 'World affairs',
    blurb: 'Alliances, intervention, sanctions and aid.',
    topics: [
      ['w1', 'PF', 'Nov/Dec 2024', 'The United States should substantially reduce its military support of Taiwan.'],
      ['w2', 'PF', 'Apr 2024', 'The United Nations should abolish permanent membership on its Security Council.'],
      ['w3', 'PF', 'Sep/Oct 2025', 'The United Kingdom should rejoin the European Union.'],
      ['w4', 'PF', 'Nov/Dec 2020', 'The United States should adopt a declaratory nuclear policy of no first use.'],
      ['w5', 'LD', 'Jan/Feb 2010', 'Economic sanctions ought not be used to achieve foreign policy objectives.'],
      ['w6', 'LD', 'Jan/Feb 2019', 'The United States ought not provide military aid to authoritarian regimes.'],
      ['w7', 'LD', 'Jan/Feb 2020', 'States ought to eliminate their nuclear arsenals.'],
      ['w8', 'LD', 'Nov/Dec 2017', 'Wealthy nations have an obligation to provide development assistance to other nations.'],
      ['w9', 'PF', 'Feb 2025', 'The United States should accede to the Rome Statute of the International Criminal Court.'],
      ['w10', 'LD', 'Mar/Apr 2014', 'Placing political conditions on humanitarian aid to foreign countries is unjust.'],
    ],
  },
  {
    id: 'economy',
    name: 'Economy and work',
    blurb: 'Wages, taxes, welfare and labor.',
    topics: [
      ['e1', 'LD', 'Mar/Apr 2018', 'The United States ought to provide a universal basic income.'],
      ['e2', 'LD', 'Nov/Dec 2024', 'The United States ought to adopt a wealth tax.'],
      ['e3', 'LD', 'Sep/Oct 2024', 'The United States ought to require that workers receive a living wage.'],
      ['e4', 'LD', 'Nov/Dec 2020', 'The United States ought to provide a federal jobs guarantee.'],
      ['e5', 'LD', 'Nov/Dec 2021', 'A just government ought to recognize an unconditional right of workers to strike.'],
      ['e6', 'PF', 'Feb 2023', 'In the United States, right-to-work laws do more harm than good.'],
      ['e7', 'PF', 'Nov/Dec 2023', 'The United States federal government should forgive all federal student loans.'],
      ['e8', 'PF', 'Mar 2026', 'The United States federal government should ban corporate acquisition of single-family residences.'],
      ['e9', 'LD', 'Sep/Oct 2023', 'The United States ought to guarantee the right to housing.'],
      ['e10', 'PF', 'Mar 2024', 'In the United States, collegiate student-athletes should be classified as employees of their educational institution.'],
    ],
  },
  {
    id: 'justice',
    name: 'Justice and law',
    blurb: 'Courts, policing, punishment and rights.',
    topics: [
      ['j1', 'LD', 'Jan/Feb 2018', 'Plea bargaining ought to be abolished in the United States criminal justice system.'],
      ['j2', 'LD', 'Mar/Apr 2024', 'The primary objective of the United States criminal justice system ought to be rehabilitation.'],
      ['j3', 'LD', 'Nov/Dec 2016', 'The United States ought to limit qualified immunity for police officers.'],
      ['j4', 'LD', 'Mar/Apr 2020', 'Predictive policing is unjust.'],
      ['j5', 'LD', 'Mar/Apr 2023', 'The justices of the Supreme Court of the United States ought to be term-limited.'],
      ['j6', 'LD', 'Jan/Feb 2011', 'In the United States, juveniles charged with violent felonies ought to be treated as adults in the criminal justice system.'],
      ['j7', 'LD', 'Mar/Apr 2019', 'The illegal use of drugs ought to be treated as a matter of public health, not of criminal justice.'],
      ['j8', 'LD', 'Nov/Dec 2015', 'In the United States criminal justice system, jury nullification ought to be used in the face of perceived injustice.'],
      ['j9', 'LD', 'Jan/Feb 2016', 'In the United States, private ownership of handguns ought to be banned.'],
      ['j10', 'PF', 'Jan 2022', 'The United States federal government should legalize all illicit drugs.'],
    ],
  },
  {
    id: 'tech',
    name: 'Science and technology',
    blurb: 'AI, privacy, space and the internet.',
    topics: [
      ['t1', 'LD', 'Mar/Apr 2025', 'The development of Artificial General Intelligence is immoral.'],
      ['t2', 'PF', 'Mar 2025', 'In the United States, the benefits of the use of generative artificial intelligence in education outweigh the harms.'],
      ['t3', 'PF', 'Jan 2024', 'The United States federal government should repeal Section 230 of the Communications Decency Act.'],
      ['t4', 'PF', 'Apr 2023', 'The United States Federal Government should ban the collection of personal data through biometric recognition technology.'],
      ['t5', 'PF', 'Nov/Dec 2025', 'The United States federal government should require technology companies to provide lawful access to encrypted communications.'],
      ['t6', 'LD', 'Jan/Feb 2021', 'States ought to ban lethal autonomous weapons.'],
      ['t7', 'LD', 'Jan/Feb 2022', 'The appropriation of outer space by private entities is unjust.'],
      ['t8', 'LD', 'Nov/Dec 2014', 'The "right to be forgotten" from Internet searches ought to be a civil right.'],
      ['t9', 'LD', 'Sep/Oct 2026', 'Outer space colonization is a moral imperative.'],
      ['t10', 'LD', 'Nov/Dec 2026', 'De-extinction is unethical.'],
    ],
  },
  {
    id: 'environment',
    name: 'Environment and energy',
    blurb: 'Climate, fossil fuels, nuclear power and land.',
    topics: [
      ['n1', 'LD', 'Nov/Dec 2023', 'The United States ought to prohibit the extraction of fossil fuels from federal public lands and waters.'],
      ['n2', 'LD', 'Nov/Dec 2019', 'The United States ought to eliminate subsidies for fossil fuels.'],
      ['n3', 'LD', 'Sep/Oct 2016', 'Countries ought to prohibit the production of nuclear power.'],
      ['n4', 'PF', 'Apr 2025', 'The United States federal government should substantially increase its investment in domestic nuclear energy.'],
      ['n5', 'PF', 'Feb 2024', 'The United States federal government should ban single-use plastics.'],
      ['n6', 'PF', 'Feb 2016', 'The United States federal government should adopt a carbon tax.'],
      ['n7', 'LD', 'Jan/Feb 2014', 'Developing countries should prioritize environmental protection over resource extraction when the two are in conflict.'],
      ['n8', 'LD', 'Nov/Dec 2025', 'The United States ought to rewild substantial tracts of land.'],
      ['n9', 'PF', 'Sep/Oct 2022', 'The United States Federal Government should substantially increase its investment in high-speed rail.'],
      ['n10', 'PF', 'Mar 2022', 'In the United States, the benefits of increasing organic agriculture outweigh the harms.'],
    ],
  },
  {
    id: 'society',
    name: 'Health and education',
    blurb: 'Healthcare, schools, testing and public health.',
    topics: [
      ['s1', 'LD', 'Sep/Oct 2022', 'The United States ought to implement a single-payer universal healthcare system.'],
      ['s2', 'LD', 'Nov/Dec 2009', 'Public health concerns justify compulsory immunization.'],
      ['s3', 'LD', 'Sep/Oct 2019', 'In the United States, colleges and universities ought not consider standardized tests in undergraduate admissions decisions.'],
      ['s4', 'LD', 'Mar/Apr 2021', 'The United States ought to guarantee universal child care.'],
      ['s5', 'LD', 'Sep/Oct 2015', 'Adolescents ought to have the right to make autonomous medical choices.'],
      ['s6', 'LD', 'Sep/Oct 2014', 'A just society ought to presume consent for organ procurement from the deceased.'],
      ['s7', 'LD', 'Jan/Feb 2017', 'Public colleges and universities in the United States ought not restrict any constitutionally protected speech.'],
      ['s8', 'PF', 'Dec 2015', 'On balance, standardized testing is beneficial to K-12 education in the United States.'],
      ['s9', 'LD', 'Sep/Oct 2021', 'The member nations of the World Trade Organization ought to reduce intellectual property protections for medicines.'],
      ['s10', 'PF', 'Nationals 2020', 'On balance, charter schools are beneficial to the quality of education in the United States.'],
    ],
  },
  {
    id: 'democracy',
    name: 'Democracy and government',
    blurb: 'Voting, the press, liberty and security.',
    topics: [
      ['d1', 'LD', 'Sep/Oct 2020', 'In a democracy, voting ought to be compulsory.'],
      ['d2', 'PF', 'Apr 2017', 'The United States ought to replace the Electoral College with a direct national popular vote.'],
      ['d3', 'LD', 'Mar/Apr 2022', 'In a democracy, a free press ought to prioritize objectivity over advocacy.'],
      ['d4', 'LD', 'Nationals 2026', 'Democracies ought to prioritize the protection of civil liberties over national security.'],
      ['d5', 'LD', 'Sep/Oct 2017', 'In the United States, national service ought to be compulsory.'],
      ['d6', 'LD', 'Nov/Dec 2018', "In a democracy, the public's right to know ought to be valued above the right to privacy of candidates for public office."],
      ['d7', 'LD', 'Nationals 2024', 'In a democracy, a people ought to have the right to secede from their government.'],
      ['d8', 'LD', 'Nationals 2021', 'A public health emergency justifies limiting civil liberties.'],
      ['d9', 'PF', 'Nationals 2025', 'On balance, in the United States, the benefits of presidential executive orders outweigh the harms.'],
      ['d10', 'PF', 'Apr 2026', "The United States should eliminate the President's authority to deploy military forces abroad without Congressional approval."],
    ],
  },
  {
    id: 'ethics',
    name: 'Ethics and philosophy',
    blurb: 'Moral obligation, justice and the individual.',
    topics: [
      ['p1', 'LD', 'Nov/Dec 2011', 'Individuals have a moral obligation to assist people in need.'],
      ['p2', 'LD', 'Sep/Oct 2011', 'Justice requires the recognition of animal rights.'],
      ['p3', 'LD', 'Jan/Feb 2023', 'Justice requires open borders for human migration.'],
      ['p4', 'LD', 'Nationals 2013', 'Oppressive government is more desirable than no government.'],
      ['p5', 'LD', 'Nationals 2025', 'Violent revolution is a just response to political oppression.'],
      ['p6', 'LD', 'Nationals 2015', 'Inaction in the face of injustice makes individuals morally culpable.'],
      ['p7', 'LD', 'Nationals 2022', 'Radicalism is preferable to incrementalism to achieve social justice.'],
      ['p8', 'LD', 'Mar/Apr 2009', 'Vigilantism is justified when the government has failed to enforce the law.'],
      ['p9', 'LD', 'Nationals 2023', 'Government employees have a moral obligation to leak classified information to address injustice.'],
      ['p10', 'LD', 'Jan/Feb 2026', 'The possession of nuclear weapons is immoral.'],
    ],
  },
].map((category) => ({
  ...category,
  topics: category.topics.map(([id, event, season, text]) => ({
    id,
    event,
    season,
    text,
    source: `${event === 'LD' ? 'Lincoln-Douglas' : 'Public Forum'}, ${season}`,
  })),
}))

export const ANY_CATEGORY = 'any'

export const CATEGORY_IDS = CATEGORIES.map((category) => category.id)

export function getCategory(id) {
  return CATEGORIES.find((category) => category.id === id) ?? null
}

export function isValidCategoryChoice(id) {
  return id === ANY_CATEGORY || CATEGORY_IDS.includes(id)
}

// Which category two queued players can share, or null if they can't.
export function resolveCategory(a, b, random = Math.random) {
  if (a === ANY_CATEGORY && b === ANY_CATEGORY) {
    return CATEGORY_IDS[Math.floor(random() * CATEGORY_IDS.length)]
  }
  if (a === ANY_CATEGORY) return b
  if (b === ANY_CATEGORY) return a
  return a === b ? a : null
}

// Picks a topic neither player has debated recently, falling back to any.
export function pickTopic(categoryId, recentIds = [], random = Math.random) {
  const category = getCategory(categoryId)
  if (!category) return null
  const fresh = category.topics.filter((topic) => !recentIds.includes(topic.id))
  const pool = fresh.length > 0 ? fresh : category.topics
  return pool[Math.floor(random() * pool.length)]
}

export function createCandidate(input) {
  return {
    dedupeKey: input.dedupeKey,
    profile: {
      fullName: input.fullName || null,
      firstName: input.firstName || null,
      lastName: input.lastName || null,
      description: input.description || null
    },
    contacts: {
      emails: input.emails || [],
      phones: input.phones || []
    },
    professional: {
      designation: input.designation || input.currentTitle || null,
      currentCompany: input.currentCompany || null,
      experienceYears: input.experienceYears ?? null,
      experienceText: input.experienceText || null,
      specialization: input.specialization || null,
      qualification: input.qualification || null,
      stream: input.stream || null,
      proficiency: input.proficiency || null,
      skills: input.skills || [],
      location: input.location || null,
      preferredLocation: input.preferredLocation || null
    },
    meta: {
      raw: input.raw || null
    },
    sources: input.sources || [],
    createdAt: input.createdAt || new Date(),
    updatedAt: input.updatedAt || new Date()
  };
}

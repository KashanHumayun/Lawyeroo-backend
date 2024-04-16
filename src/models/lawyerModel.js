class Lawyer {
    constructor({ first_name, last_name, email, fees, ph_number, address, passwordHash, specializations, years_of_experience, universities, rating, profile_picture, verified, account_type }) {
        this.first_name = first_name;
        this.last_name = last_name;
        this.email = email;
        this.fees = fees;
        this.ph_number = ph_number;
        this.address = address;
        this.passwordHash = passwordHash;  // Assuming the password is hashed before being passed to the constructor
        this.specializations = Array.isArray(specializations) ? specializations : [];
        this.years_of_experience = years_of_experience;
        this.universities = universities;
        this.rating = rating;
        this.created_at = new Date().toISOString(); // Always set on creation
        this.updated_at = new Date().toISOString(); // Always set on creation
        this.profile_picture = profile_picture;
        this.verified = verified || false;
        this.account_type = account_type || 'Lawyer';
    }

    addSpecialization(specialization) {
        if (!this.specializations.includes(specialization)) {
            this.specializations.push(specialization);
        }
    }

    removeSpecialization(specialization) {
        this.specializations = this.specializations.filter(s => s !== specialization);
    }

    updateSpecializations(specializations) {
        this.specializations = specializations;
    }

    serialize() {
        return {
            first_name: this.first_name,
            last_name: this.last_name,
            email: this.email,
            fees: this.fees,
            ph_number: this.ph_number,
            address: this.address,
            password: this.passwordHash,
            specializations: this.specializations,
            years_of_experience: this.years_of_experience,
            universities: this.universities,
            rating: this.rating,
            created_at: this.created_at,
            updated_at: this.updated_at,
            profile_picture: this.profile_picture,
            verified: this.verified,
            account_type: this.account_type
        };
    }
}

module.exports = Lawyer;

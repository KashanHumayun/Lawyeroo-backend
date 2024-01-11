class Lawyer {
    constructor(first_name, last_name, email, fees, ph_number, address, password, specializations, years_of_experience, universities, rating, created_at, updated_at, profile_picture, verified, account_type) {
        this.first_name = first_name;
        this.last_name = last_name;
        this.email = email;
        this.fees = fees;
        this.ph_number = ph_number;
        this.address = address;
        this.password = password; // Ensure to hash passwords in production
        this.specializations = specializations;
        this.years_of_experience = years_of_experience;
        this.universities = universities;
        this.rating = rating;
        this.created_at = created_at || new Date().toISOString();
        this.updated_at = updated_at || new Date().toISOString();
        this.profile_picture = profile_picture;
        this.verified = verified || false;
        this.account_type = account_type || 'Lawyer';
    }

    serialize() {
        return {
            first_name: this.first_name,
            last_name: this.last_name,
            email: this.email,
            fees: this.fees,
            ph_number: this.ph_number,
            address: this.address,
            password: this.password, // Remember to hash the password
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

// models/clientModel.js
class Client {
    constructor({
        first_name, last_name, email, ph_number, address, passwordHash,
        preferences, profile_picture, verified, account_type
    }) {
        this.first_name = first_name || "";
        this.last_name = last_name || "";
        this.email = email || "";
        this.ph_number = ph_number || "";
        this.address = address || "";
        this.password = passwordHash || ""; // Remember to hash passwords in production
        this.created_at = new Date().toISOString();
        this.updated_at = new Date().toISOString();
        this.profile_picture = profile_picture || "";
        this.verified = verified || false;
        this.account_type = account_type || 'Client';
        this.preferences = Array.isArray(preferences) ? preferences : [];
    }

    addPreference(preference) {
        if (!this.preferences.includes(preference)) {
            this.preferences.push(preference);
        }
    }

    removePreference(preference) {
        this.preferences = this.preferences.filter(p => p !== preference);
    }

    updatePreferences(preferences) {
        this.preferences = preferences;
    }

    serialize() {
        return {
            first_name: this.first_name,
            last_name: this.last_name,
            email: this.email,
            ph_number: this.ph_number,
            address: this.address,
            password: this.passwordHash,
            created_at: this.created_at,
            updated_at: this.updated_at,
            profile_picture: this.profile_picture,
            verified: this.verified,
            account_type: this.account_type,
            preferences: this.preferences
        };
    }
}

module.exports = Client;

// models/clientModel.js
class Client {
    constructor(first_name, last_name, email, ph_number, address, password, created_at, updated_at, profile_picture, verified, account_type, preferences) {
      this.first_name = first_name;
      this.last_name = last_name;
      this.email = email;
      this.ph_number = ph_number;
      this.address = address;
      this.password = password; // Remember to hash passwords in production
      this.created_at = created_at || new Date().toISOString();
      this.updated_at = updated_at || new Date().toISOString();
      this.profile_picture = profile_picture;
      this.verified = verified;
      this.account_type = account_type;
      this.preferences = preferences;
    }
  
    serialize() {
      return {
        first_name: this.first_name,
        last_name: this.last_name,
        email: this.email,
        ph_number: this.ph_number,
        address: this.address,
        password: this.password,
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
  
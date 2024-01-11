class Admin {
    constructor(first_name, last_name, email, ph_number, address, profile_picture, account_type, password) {
      this.first_name = first_name;
      this.last_name = last_name;
      this.email = email;
      this.ph_number = ph_number;
      this.address = address;
      this.profile_picture = profile_picture;
      this.account_type = account_type;
      this.password = password; // Remember to hash passwords in production
      this.created_at = new Date().toISOString();
      this.updated_at = new Date().toISOString();
    }
  
    // Method to serialize data for saving to database
    serialize() {
      return {
        first_name: this.first_name,
        last_name: this.last_name,
        email: this.email,
        ph_number: this.ph_number,
        address: this.address,
        profile_picture: this.profile_picture,
        account_type: this.account_type,
        password: this.password,
        created_at: this.created_at,
        updated_at: this.updated_at
      };
    }
  
    // Add any other methods that are relevant to your admin data
  }
  
  module.exports = Admin;
  
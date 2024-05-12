class Admin {
  constructor({ first_name, last_name, email, ph_number, address, profile_picture, account_type, passwordHash }) {
      this.first_name = first_name;
      this.last_name = last_name;
      this.email = email;
      this.ph_number = ph_number;
      this.address = address;
      this.profile_picture = profile_picture || "default.jpg";  // Default to 'default.jpg' if no picture provided
      this.account_type = account_type || "Admin";  // Default to 'Admin' if no account type provided
      this.passwordHash = passwordHash;  // Ensure this is hashed before being passed here
      this.created_at = new Date().toISOString();
      this.updated_at = new Date().toISOString();
  }

  serialize() {
      return {
          first_name: this.first_name,
          last_name: this.last_name,
          email: this.email,
          ph_number: this.ph_number,
          address: this.address,
          profile_picture: this.profile_picture,
          account_type: this.account_type,
          passwordHash: this.passwordHash,
          created_at: this.created_at,
          updated_at: this.updated_at
      };
  }
}
  module.exports = Admin;
  
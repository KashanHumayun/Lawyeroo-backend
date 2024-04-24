class Report {
    constructor({ reporter_id, report_title, report_text, report_type, status, reported_at }) {
        this.report_title = report_title;
        this.reporter_id = reporter_id;
        this.report_text = report_text;
        this.report_type = report_type;
        this.status = status || 'pending'; // Default status
        this.reported_at = reported_at || new Date().toISOString();
    }

    serialize() {
        return {
            report_title:this.report_title,
            reporter_id: this.reporter_id,
            report_text: this.report_text,
            report_type: this.report_type,
            status: this.status,
            reported_at: this.reported_at
        };
    }
}

module.exports = Report;

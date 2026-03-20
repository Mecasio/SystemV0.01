import React, { useState, useEffect, useContext, useRef } from "react";
import { SettingsContext } from "../App";
import API_BASE_URL from "../apiConfig";
import RepublicOfThePhilippines from "../assets/republicofthephilippines.png";

export default function Receipt() {
  const settings = useContext(SettingsContext);

  const [titleColor, setTitleColor] = useState("#000000");
  const [subtitleColor, setSubtitleColor] = useState("#555555");
  const [borderColor, setBorderColor] = useState("#000000");
  const [mainButtonColor, setMainButtonColor] = useState("#1976d2");
  const [subButtonColor, setSubButtonColor] = useState("#ffffff");   // ✅ NEW
  const [stepperColor, setStepperColor] = useState("#000000");       // ✅ NEW

  const [fetchedLogo, setFetchedLogo] = useState(null);
  const [companyName, setCompanyName] = useState("");
  const [shortTerm, setShortTerm] = useState("");
  const [campusAddress, setCampusAddress] = useState("");

  useEffect(() => {
    if (!settings) return;

    // 🎨 Colors
    if (settings.title_color) setTitleColor(settings.title_color);
    if (settings.subtitle_color) setSubtitleColor(settings.subtitle_color);
    if (settings.border_color) setBorderColor(settings.border_color);
    if (settings.main_button_color) setMainButtonColor(settings.main_button_color);
    if (settings.sub_button_color) setSubButtonColor(settings.sub_button_color);
    if (settings.stepper_color) setStepperColor(settings.stepper_color);

    // 🏫 Logo
    if (settings.logo_url) {
      setFetchedLogo(`${API_BASE_URL}${settings.logo_url}`);
    }

    // 🏷️ School Info
    if (settings.company_name) setCompanyName(settings.company_name);
    if (settings.short_term) setShortTerm(settings.short_term);
 if (settings.address) setCampusAddress(settings.address);
  

  }, [settings]);

  const handlePrint = () => {
    window.print();
  };



  return (
    <>
      <style>{`

/* =========================
   PAGE SETUP
========================= */
@page {
  size: 5.8in 8.3in;
  margin: 0;
}

/* =========================
   GLOBAL
========================= */
body {
  font-family: Arial;
  margin: 0;
}

.controls {
  margin: 20px;
}

button {
  padding: 8px 16px;
  font-size: 14px;
  cursor: pointer;
}

/* =========================
   PRINT SETTINGS
========================= */
@page {
  size: 5.8in 8.3in;
  margin: 0;
}

@media print {

  body {
    margin: 0;
  }

  body * {
    visibility: hidden;
  }

  .print-area,
  .print-area * {
    visibility: visible;
  }

  .print-area {
    position: absolute;
    top: 0;
    left: 0;
    width: 5.8in;
    height: 8.3in;
  }

  .controls {
    display: none !important;
  }
}

/* =========================
   RECEIPT LAYOUT
========================= */
.receipt-container {
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* TOP OUTSIDE TEXT */
.outside-top {
  width: 5.8in;
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  margin-bottom: 5px;
  color: #1f4fbf;
}

/* BOTTOM OUTSIDE NOTE */
.outside-note {
  width: 5.8in;
  font-size: 10px;
  margin-top: 8px;
  color: #1f4fbf;
}

.receipt {
  width: 5.8in;
  border: 2px solid #1f4fbf;
  padding: 15px;
  box-sizing: border-box;
  color: #1f4fbf;
  display: flex;
  flex-direction: column;
}

.header {
  text-align: center;
  margin-top: 10px;
}

/* =========================
   INVOICE SECTION
========================= */
.invoice-container {
  width: 100%;
  border: 1px solid #1f4fbf;
  
}

.invoice-row {
  display: flex;
  width: 100%;
}

.invoice-label {
  background: #1f4fbf;
  color: white;
  font-weight: bold;
  padding: 7px 15px;
  display: flex;
  width: 175px;

  align-items: center;        /* vertical center */
  justify-content: center;    /* ✅ horizontal center */

  text-align: center;         /* extra safety */
  border-right: 1px solid #1f4fbf;
}

.invoice-info {
  display: flex;
  flex: 1;
}

.info-box {
  flex: 1;
  padding: 8px 15px;
  border-left: 1px solid #1f4fbf;
  border-bottom: 1px solid #1f4fbf;
}

.field {
  padding: 8px 15px;
  font-size: 11px;
  border-top: 1px solid #1f4fbf;
  border-bottom: 1px solid #1f4fbf;
}

.table-header {
  display: flex;
   padding: 4px 5px;
  width: 100%;
  background: #1f4fbf;
  color: white;
  font-weight: bold;
  border: 1px solid #1f4fbf;
}

.col-left,
.col-right {
  flex: 1;

  text-align: center;
}

.col-left {
  border-right: 1px solid white;
}

.table-body {
  height: 210px;
  border: 1px solid #1f4fbf;
  border-top: none;
}

/* =========================
   BOTTOM SECTION
========================= */
.bottom-section {
  
  font-size: 12px;
}

.total-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.total-table td {
  border: 1px solid #1f4fbf;
  padding: 4px 6px;
  height: 26px;
  vertical-align: middle;
}

/* FIRST COLUMN */
.total-label {
  font-weight: bold;
  padding: 0; /* important for perfect centering */
}

/* Flex inside first cell */
.total-inner {
  display: flex;
  align-items: center;
  justify-content: center; /* centers the text */
  position: relative;
  height: 100%;
}

.label-text {
  margin: 0 auto;
}

.arrow {
  position: absolute;
  right: 6px; /* pushes arrow to right edge */
}

/* SECOND COLUMN */
.total-amount {
  width: 120px;
  text-align: left;
  font-weight: bold;
}
.amount-words-row {
  padding: 4px 8px;
  border: 1px solid #1f4fbf;
}

.payment-table table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.payment-table td {
  border: 1px solid #1f4fbf;
  padding: 4px 6px;
  height: 26px;
  vertical-align: middle;
}

.checkbox-cell {
  width: 180px;
}

.header-cell {
  font-size: 11px;
  text-align: center;
}

.box {
  width: 20px;
  height: 14px;
  border: 1px solid #1f4fbf;
  display: inline-block;
  margin: 0 6px 0 15px;
}

.received-text {
  padding: 6px 12px;

}

.signature-line {
  width: 260px;
  border-bottom: 1px solid #1f4fbf;
  margin: 25px auto auto;
}

.collecting-office-text {
  text-align: center;
  font-size: 12px;

}

.note {
  font-size: 10px;
  padding: 5px 10px 10px 10px;
}

`}</style>


      <div className="controls">
        <button onClick={handlePrint}>Print Receipt</button>
      </div>



      <div className="print-area">
        <div className="receipt-container">

          <div className="outside-top">
            <span>Accountable Form No. 51, Revised January, 1992</span>
            <span>(Triplicate)</span>
          </div>

          <div className="receipt">



            <div className="header">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "15px",

                }}
              >
                {/* Republic Logo */}
                <img
                  src={RepublicOfThePhilippines}
                  alt="Republic of the Philippines"
                  style={{
                    width: "80px",
                    height: "80px",
                    objectFit: "contain",
                  }}
                />

                {/* Text Section */}
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      fontSize: "18px",
                      fontWeight: "bold",
                      fontFamily: "Times new roman"

                    }}
                  >
                    Republic of the Philippines
                  </div>

                  {companyName && (
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: "bold",
                        letterSpacing: "1px",
                        fontFamily: "Times new roman",
                        
                      }}
                    >
                      {companyName}
                    </div>
                  )}

                  {campusAddress && (
                    <div style={{ fontSize: "11px", fontFamily: "Times new roman" }}>
                      {campusAddress}
                    </div>
                  )}
                </div>

                {/* School Logo from Settings */}
                {fetchedLogo && (
                  <img
                    src={fetchedLogo}
                    alt="Company Logo"
                    style={{
                      width: "80px",
                      height: "80px",
                      objectFit: "contain",
                    }}
                  />
                )}
              </div>
            </div>

            <br />
            <div className="invoice-container">
              <div className="invoice-row">
                <div className="invoice-label" sx={{ textAlign: "center" }}>INVOICE</div>

                <div className="invoice-info">
                  <div className="info-box">No.</div>
                  <div className="info-box">Date</div>
                </div>
              </div>

              <div className="field">PAYOR</div>

              <div className="table-header">
                <div className="col-left">NATURE OF COLLECTION</div>
                <div className="col-right">AMOUNT</div>
              </div>
            </div>

            <div className="table-body"></div>

            <div className="bottom-section">

              <table className="total-table">
                <tr>
                  <td className="total-label">
                    <div className="total-inner">
                      <span className="label-text">TOTAL AMOUNT PAID</span>
                      <span className="arrow">▶</span>
                    </div>
                  </td>
                  <td className="total-amount">₱</td>
                </tr>
              </table>

              <div className="amount-words-row">
                Amount in words
              </div>

              <div className="payment-table">
                <table>
                  <tbody>
                    <tr>
                      <td className="checkbox-cell">
                        <span className="box"></span> Cash
                      </td>
                      <td className="header-cell">Drawee Bank</td>
                      <td className="header-cell">Number</td>
                      <td className="header-cell">Date</td>
                    </tr>

                    <tr>
                      <td className="checkbox-cell">
                        <span className="box"></span> Check
                      </td>
                      <td></td>
                      <td></td>
                      <td></td>
                    </tr>

                    <tr>
                      <td className="checkbox-cell">
                        <span className="box"></span> Money Order
                      </td>
                      <td></td>
                      <td></td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="received-text">
                Received the Amount Stated Above
              </div>

              <div className="signature-line"></div>
              <div className="collecting-office-text">Collecting Office</div>



            </div>


          </div>
          <div className="outside-note">
            Note: Write the number and date of this receipt on the back of check or money order received.
          </div>
        </div>
      </div>
    </>
  );
}

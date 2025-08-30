Changes made to version 1.1.5

Added url input from the Simulador de Prestamos app to the Verification.jsx component

# Loans pre aproval form

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Scripts Structure

In the SRC project directory:

│   App.css
│   App.js
│   App.test.js
│   firebase.js
│   index.css
│   index.js
│   reportWebVitals.js
│   setupTests.js
│
├───assets
│       logo-blanco.png
│       logo_textoblanco_fondotransp.png
│
├───components
│       Footer.jsx
│       Header.jsx
│
├───css
│       App.css
│       Dashboard.css
│       Footer.css
│       Header.css
│       Login.css
│       Register.css
│       Reset.css
│
├───pages
│       ClientForm.jsx
│       Dashboard.js
│       Login.js
│       Register.js
│       Report.js
│       Reset.js
│
└───utils
        imports.js


### `CSS`

In this folder there are style for each component and each view that needs it

### `utils`

Within this folder you can find the imports.js file.

### `pages`

** ClientForm.jsx **
Main form where loan seeker users will fill their contact information and all the documents requiered to fulfill their requested loans.

** Dashboard.js **
Main entry point for the app. This page should display a field called CUIT where user will enter their unique goverment ids (CUIT) and the web app should check the database in order to make sure this id was not used in the last month.


** Login.js **

** Register.js **

** Report.js **
This is the main dashboard for the admin user. The idea is that the user can use this dashboard to get the list of users who submited the form.

** Reset.js **

### `components`

In this directory you can find both the Footer and Header files for use trought the project 


## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)

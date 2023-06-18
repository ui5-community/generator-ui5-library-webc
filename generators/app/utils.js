const extractPackageNameAndVersion = (s) => {
	let ns;
	let n;
	let ver;

	let parts = s.split("/");
	if (parts.length === 1) {
		ns = "";
		n = s;
	} else {
		ns = parts[0];
		n = parts[1];
	}

	parts = n.split("@");
	if (parts.length === 1) {
		ver = "latest";
	} else {
		n = parts[0];
		ver = parts[1];
	}

	return {
		name: ns ? `${ns}/${n}` : n,
		version: ver
	};
};

export { extractPackageNameAndVersion };
